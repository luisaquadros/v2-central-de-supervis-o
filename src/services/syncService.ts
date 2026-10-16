import { TABELAS_CRITICAS } from '../server/coordenacaoCritica';
import { gravarCriticoCoordenado, obterPerfilServidor } from './escritaCoordenadaService';
import { carregarViaServidor } from './leituraServidor';
import { exigirPerfilLeitura } from './leituraPermissoes';
/**
 * CENTRAL DE SUPERVISÃO - CAMADA DE SINCRONIZAÇÃO E CONTROLE DE FILA (syncService)
 *
 * Hierarquia estrita:
 * 1. Google Sheets = Fonte Oficial dos Dados
 * 2. IndexedDB = Cópia Persistente de Trabalho
 * 3. syncQueue = Fila Local de Alterações Não Sincronizadas
 *
 * Comportamento:
 * - Abertura instantânea a partir do IndexedDB.
 * - Sincronização em background quando houver autenticação Google válida.
 * - Falha de conexão/OAuth preserva integralmente os dados locais.
 * - Gravação resiliente: quando offline/sem conexão, enfileira no syncQueue.
 * - Serialização local e entre abas; edição simultânea em dispositivos distintos ainda requer homologação.
 * - Replay seguro da fila após reconexão com remoção estrita somente após confirmação do Sheets.
 */

import {
  salvarTabelasNoIndexedDb,
  salvarAlteracaoAtomica,
  salvarTabelaUnicaNoIndexedDb,
  carregarTodasTabelasDoIndexedDb,
  salvarMetaSincronizacao,
  carregarMetaSincronizacao,
  enfileirarAlteracaoLocal,
  carregarFilaSincronizacao,
  atualizarItemFila,
  removerItemFilaConfirmado,
  SyncMeta,
  SyncQueueItem,
  SyncQueueOpTipo,
} from './indexedDbService';
import {
  carregarDadosDaPlanilhaOficial,
  gravarRegistroNaPlanilhaOficial,
  removerRegistroDaPlanilhaOficial,
  getAccessToken,
  TABELAS_NORMALIZADAS,
} from './googleSheetsService';
import { validarEscritaTabela } from './safeWriteService';
import { DadosIniciais } from './dadosIniciais';

export interface SyncStatusState {
  status: 'SINCRONIZADO' | 'LOCAL' | 'SINCRONIZANDO' | 'ERRO' | 'PARCIAL';
  ultimaSincronizacao: string | null;
  ultimaLeituraSucesso: string | null;
  ultimaEscritaSucesso: string | null;
  pendentesCount: number;
  conflitosCount: number;
  erros: string[];
  tabelasStatus: Record<string, { ok: boolean; count: number; error?: string }>;
}

// Serialize reads and writes, including across tabs where Web Locks is available.
let operationTail: Promise<unknown> = Promise.resolve();
function exclusively<T>(work: () => Promise<T>): Promise<T> {
  const run = () => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('central-supervisao-sync', work) : work();
  const result = operationTail.then(run, run);
  operationTail = result.catch(() => {});
  return result;
}

let syncStatusListeners: ((status: SyncStatusState) => void)[] = [];
let currentSyncState: SyncStatusState = {
  status: 'LOCAL',
  ultimaSincronizacao: null,
  ultimaLeituraSucesso: null,
  ultimaEscritaSucesso: null,
  pendentesCount: 0,
  conflitosCount: 0,
  erros: [],
  tabelasStatus: {},
};

export function subscribeSyncStatus(listener: (status: SyncStatusState) => void): () => void {
  syncStatusListeners.push(listener);
  listener(currentSyncState);
  return () => {
    syncStatusListeners = syncStatusListeners.filter(l => l !== listener);
  };
}

function notifySyncStatusChange(updates: Partial<SyncStatusState>) {
  currentSyncState = { ...currentSyncState, ...updates };
  syncStatusListeners.forEach(l => l(currentSyncState));
}

/**
 * 1. Inicializa o estado com o cache persistente do IndexedDB
 */
export async function inicializarCacheLocal(): Promise<{
  dados: DadosIniciais | null;
  meta: SyncMeta | null;
  fila: SyncQueueItem[];
}> {
  try {
    const [tabelasMap, meta, fila] = await Promise.all([
      carregarTodasTabelasDoIndexedDb(),
      carregarMetaSincronizacao(),
      carregarFilaSincronizacao(),
    ]);

    const pendentes = fila.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO' || i.status === 'SINCRONIZANDO');
    const conflitos = fila.filter(i => i.status === 'CONFLITO');

    if (meta) {
      currentSyncState = {
        status: conflitos.length > 0 ? 'PARCIAL' :
          pendentes.length > 0 ? 'LOCAL' :
          meta.status === 'SINCRONIZANDO' ? 'LOCAL' : meta.status,
        ultimaSincronizacao: meta.ultimaSincronizacao,
        ultimaLeituraSucesso: meta.ultimaLeituraSucesso,
        ultimaEscritaSucesso: meta.ultimaEscritaSucesso,
        pendentesCount: pendentes.length,
        conflitosCount: conflitos.length,
        erros: meta.erros || [],
        tabelasStatus: meta.tabelasStatus || {},
      };
      notifySyncStatusChange({});
    } else {
      notifySyncStatusChange({
        status: 'LOCAL',
        pendentesCount: pendentes.length,
        conflitosCount: conflitos.length,
      });
    }

    if (!tabelasMap || Object.keys(tabelasMap).length === 0) {
      return { dados: null, meta, fila };
    }

    const dadosTipados: DadosIniciais = {
      periodos: tabelasMap['periodos'] || [],
      disciplinas: tabelasMap['disciplinas'] || [],
      turmas: tabelasMap['turmas'] || [],
      horarios: tabelasMap['horarios_turma'] || [],
      turmasOrigem: tableDataOrEmpty(tabelasMap, 'turmas_origem'),
      alunos: tabelasMap['alunos'] || [],
      matriculas: tabelasMap['matriculas'] || [],
      criterios: tabelasMap['criterios_avaliacao'] || [],
      orientacoes: tabelasMap['orientacoes'] || [],
      configuracoes: tabelasMap['configuracoes'] || [],
      marcos: tabelasMap['marcos_academicos'] || [],
      pontosAcompanhamento: tabelasMap['pontos_acompanhamento'] || [],
      frequencias: tabelasMap['frequencias'] || [],
      documentos: tabelasMap['documentos'] || [],
      registrosSemanais: tabelasMap['registros_semanais'] || [],
      avaliacoes: tabelasMap['avaliacoes'] || [],
      feedbacks: tabelasMap['feedback_alunos'] || [],
      ocorrencias: tabelasMap['ocorrencias'] || [],
      regrasRss: tabelasMap['regras_rss'] || [],
      calendarioRss: tabelasMap['calendario_rss'] || [],
      statusRssUnidades: tabelasMap['status_rss_unidades'] || [],
      situacaoAtualTurmas: tabelasMap['situacao_atual_turmas'] || [],
      leiturasResponsaveis: tabelasMap['leituras_responsaveis'] || [],
      regrasPrazo: tabelasMap['regras_prazo'] || [],
      gruposPratica: tabelasMap['grupos_pratica'] || [],
      grupoIntegrantes: tabelasMap['grupo_integrantes'] || [],
      entregas: tabelasMap['entregas'] || [],
      feedbacksOficiais: tabelasMap['feedbacks'] || [],
      registrosSupervisao: tabelasMap['registros_supervisao'] || [],
      encontrosTurma: tabelasMap['encontros_turma'] || [],
      preparacoesAula: tabelasMap['preparacoes_aula'] || [],
      monitoramentoDocumentos: tabelasMap['monitoramento_documentos'] || [],
      avaliacoesCompletas: tabelasMap['avaliacoes_completas'] || [],
      configAvaliacao: tabelasMap['config_avaliacao'] || [],
      rubricasAvaliacao: tabelasMap['rubricas_avaliacao'] || [],
      rascunhosAvaliacao: tabelasMap['avaliacao_rascunhos'] || [],
      evidenciasAvaliacao: tabelasMap['evidencias_avaliacao'] || [],
      rssAjustes: tabelasMap['rss_ajustes'] || [],
      sincronizacao: tabelasMap['sincronizacao'] || [],
      dicionarioDados: tabelasMap['dicionario_dados'] || [],
      contratoApp: tabelasMap['contrato_app'] || [],
      mapeamentoFontes: tabelasMap['mapeamento_fontes'] || [],
      auditoriaBase: tabelasMap['auditoria_base'] || [],
    };

    return { dados: dadosTipados, meta, fila };
  } catch (err: any) {
    console.error('Erro ao inicializar cache do IndexedDB:', err);
    return { dados: null, meta: null, fila: [] };
  }
}

function tableDataOrEmpty(map: Record<string, any[]>, key: string): any[] {
  return map[key] || [];
}

/**
 * 2. Sincronização completa de leitura da base oficial (Google Sheets)
 * Respeita a regra canônica: NUNCA substituir dados locais válidos por arrays vazios
 */
async function sincronizarDaBaseOficialInterna(): Promise<{
  sucesso: boolean;
  dados?: DadosIniciais;
  erro?: string;
}> {
  notifySyncStatusChange({ status: 'SINCRONIZANDO' });

  try {
    const token = await getAccessToken();
    if (!token) {
      notifySyncStatusChange({
        status: currentSyncState.ultimaSincronizacao ? 'LOCAL' : 'ERRO',
        erros: ['Autenticação necessária para sincronizar com Google Sheets.'],
      });
      return { sucesso: false, erro: 'Não autenticado no Google.' };
    }

    // Antes de qualquer replay da fila, o servidor precisa confirmar o perfil atual.
    // A posse do cache por UID é verificada nos fluxos de autenticação do aplicativo.
    const perfilServidor = exigirPerfilLeitura(await obterPerfilServidor());
    // Alterações locais precisam ser confirmadas antes de aceitar o snapshot remoto.
    // Caso permaneçam pendentes, a leitura não pode sobrescrever essas tabelas.
    await processarFilaInterna();
    const pendentesAntesDaLeitura = (await carregarFilaSincronizacao())
      .filter(i => ['PENDENTE', 'ERRO', 'SINCRONIZANDO', 'CONFLITO'].includes(i.status));
    const tabelasComEscritaPendente = new Set(pendentesAntesDaLeitura.map(i => i.tabela));

    // Carrega o cache anterior do IndexedDB antes de buscar dados novos
    const cacheAnterior = (await carregarTodasTabelasDoIndexedDb()) || {};

    // Executa a busca resiliente na planilha oficial
    // Monitoras não leem a planilha diretamente: o servidor entrega só o que foi delegado a elas.
    const resultado = perfilServidor.papel === 'MONITORA'
      ? await carregarViaServidor(perfilServidor)
      : await carregarDadosDaPlanilhaOficial();
    const restritas: string[] = (resultado as any)._restritas || [];
    const rawMap = (resultado as any)._rawMap || {};
    const missingSheets = (resultado as any)._missingSheets || [];

    // Falha segura: tabelas fundamentais devem vir de uma leitura autenticada,
    // nunca apenas do cache, antes de liberar acesso à base acadêmica.
    const essenciais = ['periodos', 'disciplinas', 'turmas', 'alunos', 'matriculas'];
    const indisponiveis = essenciais.filter(tab => !Array.isArray(rawMap[tab]) || rawMap[tab].length === 0);
    if (indisponiveis.length > 0) {
      const erro = `Falha ao validar tabelas essenciais da planilha: ${indisponiveis.join(', ')}.`;
      notifySyncStatusChange({ status: 'ERRO', erros: [erro] });
      return { sucesso: false, erro };
    }

    const tabelasStatus: Record<string, { ok: boolean; count: number; error?: string }> = {};
    const erros: string[] = [];

    // Mesclagem segura: atualiza apenas tabelas que retornaram linhas ou tabelas novas
    const mapParaSalvar: Record<string, any[]> = { ...cacheAnterior };

    TABELAS_NORMALIZADAS.forEach(tab => {
      if (restritas.includes(tab)) {
        // Não delegada a este perfil: nunca fica no aparelho (apaga cópia deixada por outra conta neste navegador).
        mapParaSalvar[tab] = [];
        tabelasStatus[tab] = { ok: true, count: 0 };
        return;
      }
      if (tabelasComEscritaPendente.has(tab)) {
        tabelasStatus[tab] = {
          ok: false,
          count: (cacheAnterior[tab] || []).length,
          error: 'Alterações locais aguardando confirmação; snapshot remoto não aplicado.',
        };
        erros.push(`Tabela ${tab} possui alterações locais pendentes de sincronização.`);
        return;
      }
      const rows = rawMap[tab];
      if (Array.isArray(rows) && rows.length > 0) {
        mapParaSalvar[tab] = rows;
        tabelasStatus[tab] = { ok: true, count: rows.length };
      } else if (Array.isArray(rows) && rows.length === 0) {
        // A successfully read empty table is authoritative (including remote deletions).
        mapParaSalvar[tab] = [];
        tabelasStatus[tab] = { ok: true, count: 0 };
      } else {
        // Tabela ausente ou não lida
        if (cacheAnterior[tab] && cacheAnterior[tab].length > 0) {
          tabelasStatus[tab] = {
            ok: false,
            count: cacheAnterior[tab].length,
            error: 'Não lida nesta execução; dados locais anteriores preservados.',
          };
        } else {
          tabelasStatus[tab] = { ok: false, count: 0, error: 'Aba não encontrada na planilha oficial' };
        }
        if (!missingSheets.includes(tab)) {
          erros.push(`Tabela ${tab} não retornou dados.`);
        }
      }
    });

    if (missingSheets.length > 0) {
      erros.push(`Abas ausentes na planilha: ${missingSheets.join(', ')}`);
    }

    // Salva a cópia no cache persistente do IndexedDB
    await salvarTabelasNoIndexedDb(mapParaSalvar);

    const now = new Date().toISOString();
    const novoStatus: SyncStatusState['status'] = erros.length > 0 ? 'PARCIAL' : 'SINCRONIZADO';

    const novoMeta: SyncMeta = {
      ultimaSincronizacao: now,
      ultimaLeituraSucesso: now,
      ultimaEscritaSucesso: currentSyncState.ultimaEscritaSucesso,
      status: novoStatus,
      erros,
      tabelasStatus,
    };

    await salvarMetaSincronizacao(novoMeta);

    notifySyncStatusChange({
      status: novoStatus,
      ultimaSincronizacao: now,
      ultimaLeituraSucesso: now,
      erros,
      tabelasStatus,
    });


    // Monta o retorno garantindo que dados anteriores preservados constem na resposta
    const dadosConsolidados: DadosIniciais = {
      periodos: mapParaSalvar['periodos'] || [],
      disciplinas: mapParaSalvar['disciplinas'] || [],
      turmas: mapParaSalvar['turmas'] || [],
      horarios: mapParaSalvar['horarios_turma'] || [],
      turmasOrigem: mapParaSalvar['turmas_origem'] || [],
      alunos: mapParaSalvar['alunos'] || [],
      matriculas: mapParaSalvar['matriculas'] || [],
      criterios: mapParaSalvar['criterios_avaliacao'] || [],
      orientacoes: mapParaSalvar['orientacoes'] || [],
      configuracoes: mapParaSalvar['configuracoes'] || [],
      marcos: mapParaSalvar['marcos_academicos'] || [],
      pontosAcompanhamento: mapParaSalvar['pontos_acompanhamento'] || [],
      frequencias: mapParaSalvar['frequencias'] || [],
      documentos: mapParaSalvar['documentos'] || [],
      registrosSemanais: mapParaSalvar['registros_semanais'] || [],
      avaliacoes: mapParaSalvar['avaliacoes'] || [],
      feedbacks: mapParaSalvar['feedback_alunos'] || [],
      ocorrencias: mapParaSalvar['ocorrencias'] || [],
      regrasRss: mapParaSalvar['regras_rss'] || [],
      calendarioRss: mapParaSalvar['calendario_rss'] || [],
      statusRssUnidades: mapParaSalvar['status_rss_unidades'] || [],
      situacaoAtualTurmas: mapParaSalvar['situacao_atual_turmas'] || [],
      leiturasResponsaveis: mapParaSalvar['leituras_responsaveis'] || [],
      regrasPrazo: mapParaSalvar['regras_prazo'] || [],
      gruposPratica: mapParaSalvar['grupos_pratica'] || [],
      grupoIntegrantes: mapParaSalvar['grupo_integrantes'] || [],
      entregas: mapParaSalvar['entregas'] || [],
      feedbacksOficiais: mapParaSalvar['feedbacks'] || [],
      registrosSupervisao: mapParaSalvar['registros_supervisao'] || [],
      encontrosTurma: mapParaSalvar['encontros_turma'] || [],
      preparacoesAula: mapParaSalvar['preparacoes_aula'] || [],
      monitoramentoDocumentos: mapParaSalvar['monitoramento_documentos'] || [],
      avaliacoesCompletas: mapParaSalvar['avaliacoes_completas'] || [],
      configAvaliacao: mapParaSalvar['config_avaliacao'] || [],
      rubricasAvaliacao: mapParaSalvar['rubricas_avaliacao'] || [],
      rascunhosAvaliacao: mapParaSalvar['avaliacao_rascunhos'] || [],
      evidenciasAvaliacao: mapParaSalvar['evidencias_avaliacao'] || [],
      rssAjustes: mapParaSalvar['rss_ajustes'] || [],
      sincronizacao: mapParaSalvar['sincronizacao'] || [],
      dicionarioDados: mapParaSalvar['dicionario_dados'] || [],
      contratoApp: mapParaSalvar['contrato_app'] || [],
      mapeamentoFontes: mapParaSalvar['mapeamento_fontes'] || [],
      auditoriaBase: mapParaSalvar['auditoria_base'] || [],
    };

    return { sucesso: true, dados: dadosConsolidados };
  } catch (err: any) {
    console.error('Erro na sincronização da planilha oficial:', err);
    const msg = err?.message || 'Falha ao sincronizar com Google Sheets';

    notifySyncStatusChange({
      status: currentSyncState.ultimaSincronizacao ? 'LOCAL' : 'ERRO',
      erros: [msg],
    });

    return { sucesso: false, erro: msg };
  }
}

/**
 * 3. Gravação resiliente de alterações
 * Se online com token: grava diretamente no Google Sheets e atualiza cache
 * Se offline ou erro temporário: salva na fila syncQueue no IndexedDB
 */
export function salvarRegistroResiliente(
  tabela: string, tipo: SyncQueueOpTipo, registro: Record<string, any>,
  _tabelaAtualizadaCompleta?: any[]
): Promise<{ gravadoOnline: boolean; enfileiradoOffline: boolean; queueItem?: SyncQueueItem }> {
  return exclusively(async () => {
    const validacao = validarEscritaTabela(tabela, registro);
    if (!validacao.valido) throw new Error(validacao.motivo);
    const item = await salvarAlteracaoAtomica(tabela, tipo, registro);
    await processarFilaInterna();
    const filaAposGravar = await carregarFilaSincronizacao();
    const itemRestante = filaAposGravar.find(i => i.id === item.id);
    if (itemRestante?.status === 'CONFLITO') {
      // Registro e versão original continuam na fila, mas o usuário deve
      // ver o conflito; nunca confirmar como mero salvamento offline.
      throw new Error(itemRestante.erro || 'CONFLITO_VERSAO: revisão necessária antes da sincronização.');
    }
    const pending = !!itemRestante;
    return { gravadoOnline: !pending, enfileiradoOffline: pending, queueItem: itemRestante };
  });
}

export function sincronizarDaBaseOficial() {
  return exclusively(sincronizarDaBaseOficialInterna);
}
export function processarFilaSincronizacao() {
  return exclusively(processarFilaInterna);
}

/**
 * 4. Processamento da fila de sincronização (syncQueue) com detecção de conflitos
 * Nunca remove o item antes da confirmação real no Google Sheets
 */
async function processarFilaInterna(): Promise<{
  processados: number;
  erros: number;
  conflitos: number;
}> {
  const fila = await carregarFilaSincronizacao();
  const pendentes = fila.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO' || i.status === 'SINCRONIZANDO');

  if (pendentes.length === 0) {
    const conflitosNaFila = fila.filter(i => i.status === 'CONFLITO').length;
    notifySyncStatusChange({
      pendentesCount: 0, conflitosCount: conflitosNaFila,
      status: conflitosNaFila > 0 || currentSyncState.erros.length > 0
        ? 'PARCIAL'
        : currentSyncState.status === 'SINCRONIZANDO' ? 'LOCAL' : currentSyncState.status,
    });
    return { processados: 0, erros: 0, conflitos: conflitosNaFila };
  }

  const token = await getAccessToken();
  if (!token) {
    const conflitosNaFila = fila.filter(i => i.status === 'CONFLITO').length;
    notifySyncStatusChange({
      status: conflitosNaFila > 0 ? 'PARCIAL' : 'LOCAL',
      pendentesCount: pendentes.length, conflitosCount: conflitosNaFila,
    });
    return { processados: 0, erros: 0, conflitos: conflitosNaFila };
  }

  let processados = 0;
  let erros = 0;
  let conflitos = 0;

  for (const item of pendentes) {
    try {
      await atualizarItemFila(item.id, { status: 'SINCRONIZANDO', tentativas: item.tentativas + 1 });

      if (TABELAS_CRITICAS.has(item.tabela)) {
        await gravarCriticoCoordenado(item);
      } else if (item.tipo === 'DELETE') {
        await removerRegistroDaPlanilhaOficial(item.tabela, item.payload);
      } else {
        await gravarRegistroNaPlanilhaOficial(item.tabela, item.payload);
      }

      // Confirmação real recebida: remove do syncQueue
      await removerItemFilaConfirmado(item.id);
      processados++;
    } catch (err: any) {
      console.error(`Erro ao sincronizar item ${item.id} da fila:`, err);
      erros++;
      const is401 = err?.message?.includes('Sessão expirada') || err?.message?.includes('401');
      const ehConflito = String(err?.message||'').includes('CONFLITO_VERSAO');
      await atualizarItemFila(item.id, {
        status: ehConflito ? 'CONFLITO' : 'ERRO',
        erro: err?.message || 'Falha ao sincronizar com Google Sheets',
      });
      if(ehConflito) conflitos++;
      break; // Preserve operation order and avoid cascading requests after any failure.
    }
  }

  const filaAtualizada = await carregarFilaSincronizacao();
  const pendentesRestantes = filaAtualizada.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO' || i.status === 'SINCRONIZANDO');
  const conflitosRestantes = filaAtualizada.filter(i => i.status === 'CONFLITO');

  const now = new Date().toISOString();
  notifySyncStatusChange({
    pendentesCount: pendentesRestantes.length,
    conflitosCount: conflitosRestantes.length,
    ultimaEscritaSucesso: processados > 0 ? now : currentSyncState.ultimaEscritaSucesso,
    status: pendentesRestantes.length > 0 ? 'LOCAL' : conflitosRestantes.length > 0 || currentSyncState.erros.length > 0 ? 'PARCIAL' : 'SINCRONIZADO',
  });

  return { processados, erros, conflitos };
}
