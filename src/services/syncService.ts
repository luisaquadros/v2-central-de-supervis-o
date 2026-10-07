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
 * - Detecção estrita de conflitos: nunca sobrescreve dado oficial mais recente.
 * - Replay seguro da fila após reconexão com remoção estrita somente após confirmação do Sheets.
 */

import {
  salvarTabelasNoIndexedDb,
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
  getAccessToken,
  TABELAS_NORMALIZADAS,
} from './googleSheetsService';
import { validarEscritaTabela } from './safeWriteService';
import { DadosIniciaisGas } from './gasService';

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
  dados: DadosIniciaisGas | null;
  meta: SyncMeta | null;
  fila: SyncQueueItem[];
}> {
  try {
    const [tabelasMap, meta, fila] = await Promise.all([
      carregarTodasTabelasDoIndexedDb(),
      carregarMetaSincronizacao(),
      carregarFilaSincronizacao(),
    ]);

    const pendentes = fila.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO');
    const conflitos = fila.filter(i => i.status === 'CONFLITO');

    if (meta) {
      currentSyncState = {
        status: meta.status === 'SINCRONIZANDO' ? 'LOCAL' : meta.status,
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

    const dadosTipados: DadosIniciaisGas = {
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
export async function sincronizarDaBaseOficial(): Promise<{
  sucesso: boolean;
  dados?: DadosIniciaisGas;
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

    // Carrega o cache anterior do IndexedDB antes de buscar dados novos
    const cacheAnterior = (await carregarTodasTabelasDoIndexedDb()) || {};

    // Executa a busca resiliente na planilha oficial
    const resultado = await carregarDadosDaPlanilhaOficial();
    const rawMap = (resultado as any)._rawMap || {};
    const missingSheets = (resultado as any)._missingSheets || [];

    const tabelasStatus: Record<string, { ok: boolean; count: number; error?: string }> = {};
    const erros: string[] = [];

    // Mesclagem segura: atualiza apenas tabelas que retornaram linhas ou tabelas novas
    const mapParaSalvar: Record<string, any[]> = { ...cacheAnterior };

    TABELAS_NORMALIZADAS.forEach(tab => {
      const rows = rawMap[tab];
      if (Array.isArray(rows) && rows.length > 0) {
        mapParaSalvar[tab] = rows;
        tabelasStatus[tab] = { ok: true, count: rows.length };
      } else if (Array.isArray(rows) && rows.length === 0) {
        // Se a resposta retornou 0 linhas mas já tínhamos cache anterior válido, PRESERVA o cache anterior
        if (cacheAnterior[tab] && cacheAnterior[tab].length > 0) {
          tabelasStatus[tab] = {
            ok: true,
            count: cacheAnterior[tab].length,
            error: 'Planilha retornou vazia; dados locais preservados.',
          };
        } else {
          mapParaSalvar[tab] = [];
          tabelasStatus[tab] = { ok: true, count: 0 };
        }
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

    // Replay de escritas pendentes se houver
    processarFilaSincronizacao().catch(e => console.warn('Aviso no processamento da fila:', e));

    // Monta o retorno garantindo que dados anteriores preservados constem na resposta
    const dadosConsolidados: DadosIniciaisGas = {
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
export async function salvarRegistroResiliente(
  tabela: string,
  tipo: SyncQueueOpTipo,
  registro: Record<string, any>,
  tabelaAtualizadaCompleta?: any[]
): Promise<{ gravadoOnline: boolean; enfileiradoOffline: boolean; queueItem?: SyncQueueItem; erro?: string }> {
  // 1. Validação estrita via safeWriteService (bloqueia abas-fonte e tabelas não autorizadas)
  const validacao = validarEscritaTabela(tabela, registro);
  if (!validacao.valido) {
    throw new Error(validacao.motivo);
  }

  // Atualiza imediatamente o IndexedDB com a cópia local se a lista completa foi passada
  if (tabelaAtualizadaCompleta && Array.isArray(tabelaAtualizadaCompleta)) {
    await salvarTabelaUnicaNoIndexedDb(tabela, tabelaAtualizadaCompleta).catch(e =>
      console.warn('Erro ao atualizar cache local único:', e)
    );
  }

  const token = await getAccessToken();

  // Se autenticado, tenta gravar imediatamente no Google Sheets
  if (token) {
    try {
      if (tipo === 'INSERT') {
        await gravarRegistroNaPlanilhaOficial(tabela, registro);
      }
      const now = new Date().toISOString();
      notifySyncStatusChange({
        ultimaEscritaSucesso: now,
        ultimaSincronizacao: now,
        status: currentSyncState.pendentesCount > 0 ? 'LOCAL' : 'SINCRONIZADO',
      });
      return { gravadoOnline: true, enfileiradoOffline: false };
    } catch (err: any) {
      console.warn(`Falha na escrita direta na tabela ${tabela}. Enfileirando localmente:`, err.message);
    }
  }

  // Se não foi possível gravar online, enfileira com ID estável no IndexedDB
  const stableId =
    (tabela === 'frequencias' && registro.matricula_id && registro.data_aula
      ? `freq_${registro.matricula_id}_${registro.data_aula}`
      : null) ||
    registro.id ||
    registro[`${tabela}_id`] ||
    registro.registro_id ||
    registro.orientacao_id ||
    registro.entrega_id ||
    `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const item = await enfileirarAlteracaoLocal({
    id: stableId,
    tabela,
    tipo,
    payload: registro,
  });

  const fila = await carregarFilaSincronizacao();
  const pendentes = fila.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO');

  notifySyncStatusChange({
    pendentesCount: pendentes.length,
    status: 'LOCAL',
  });

  return { gravadoOnline: false, enfileiradoOffline: true, queueItem: item };
}

/**
 * 4. Processamento da fila de sincronização (syncQueue) com detecção de conflitos
 * Nunca remove o item antes da confirmação real no Google Sheets
 */
export async function processarFilaSincronizacao(): Promise<{
  processados: number;
  erros: number;
  conflitos: number;
}> {
  const fila = await carregarFilaSincronizacao();
  const pendentes = fila.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO');

  if (pendentes.length === 0) {
    notifySyncStatusChange({ pendentesCount: 0 });
    return { processados: 0, erros: 0, conflitos: 0 };
  }

  const token = await getAccessToken();
  if (!token) {
    return { processados: 0, erros: 0, conflitos: 0 };
  }

  let processados = 0;
  let erros = 0;
  let conflitos = 0;

  for (const item of pendentes) {
    try {
      await atualizarItemFila(item.id, { status: 'SINCRONIZANDO', tentativas: item.tentativas + 1 });

      if (item.tipo === 'INSERT') {
        await gravarRegistroNaPlanilhaOficial(item.tabela, item.payload);
      }

      // Confirmação real recebida: remove do syncQueue
      await removerItemFilaConfirmado(item.id);
      processados++;
    } catch (err: any) {
      console.error(`Erro ao sincronizar item ${item.id} da fila:`, err);
      erros++;
      const is401 = err?.message?.includes('Sessão expirada') || err?.message?.includes('401');
      await atualizarItemFila(item.id, {
        status: 'ERRO',
        erro: err?.message || 'Falha ao sincronizar com Google Sheets',
      });
      if (is401) {
        break; // Interrompe reenvio para não disparar requisições em cascata com token expirado
      }
    }
  }

  const filaAtualizada = await carregarFilaSincronizacao();
  const pendentesRestantes = filaAtualizada.filter(i => i.status === 'PENDENTE' || i.status === 'ERRO');
  const conflitosRestantes = filaAtualizada.filter(i => i.status === 'CONFLITO');

  const now = new Date().toISOString();
  notifySyncStatusChange({
    pendentesCount: pendentesRestantes.length,
    conflitosCount: conflitosRestantes.length,
    ultimaEscritaSucesso: processados > 0 ? now : currentSyncState.ultimaEscritaSucesso,
    status: pendentesRestantes.length > 0 ? 'LOCAL' : 'SINCRONIZADO',
  });

  return { processados, erros, conflitos };
}
