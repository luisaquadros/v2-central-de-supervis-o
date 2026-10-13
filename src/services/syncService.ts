/**
 * Sincronização entre o aparelho e a planilha oficial.
 *
 * 1. Google Sheets = fonte oficial.
 * 2. IndexedDB = cópia de trabalho (o app abre na hora, mesmo sem internet).
 * 3. Fila local = alterações ainda não confirmadas pela planilha.
 *
 * - Toda alteração é salva no aparelho e na fila na MESMA transação.
 * - A fila é reenviada na ordem em que foi criada, em lotes por aba.
 * - Um item só sai da fila depois que a planilha confirma a gravação.
 * - Enquanto uma aba tem alterações pendentes, a leitura da planilha não a sobrescreve.
 */
import {
  salvarTabelasNoIndexedDb,
  salvarAlteracoesAtomicas,
  carregarTodasTabelasDoIndexedDb,
  salvarMetaSincronizacao,
  carregarMetaSincronizacao,
  carregarFilaSincronizacao,
  atualizarItemFila,
  removerItemFilaConfirmado,
  SyncMeta,
  SyncQueueItem,
  SyncQueueOpTipo,
} from './indexedDbService';
import {
  carregarDadosDaPlanilhaOficial,
  gravarLoteNaPlanilhaOficial,
  removerRegistroDaPlanilhaOficial,
  getAccessToken,
} from './googleSheetsService';
import { validarEscritaTabela } from './safeWriteService';
import { normalizarLinhasDaAba } from './normalizacaoPlanilha';
import { COLUNAS_DAS_ABAS_DO_APP, TABELAS_ESSENCIAIS, TABELAS_LIDAS, montarDadosBase } from './tabelas';
import type { DadosBase } from '../types';

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

const TAMANHO_MAX_LOTE = 200;

// Serializa leituras e gravações, inclusive entre abas do navegador (Web Locks).
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

const estaPendente = (i: SyncQueueItem) => i.status === 'PENDENTE' || i.status === 'ERRO' || i.status === 'SINCRONIZANDO';

function normalizarMapa(mapa: Record<string, any[]>): Record<string, any[]> {
  const saida: Record<string, any[]> = {};
  for (const [tabela, linhas] of Object.entries(mapa)) {
    saida[tabela] = Array.isArray(linhas) ? normalizarLinhasDaAba(tabela, linhas) : [];
  }
  return saida;
}

/** 1. Abre o app com a cópia salva no aparelho. */
export async function inicializarCacheLocal(): Promise<{ dados: DadosBase | null; meta: SyncMeta | null; fila: SyncQueueItem[] }> {
  try {
    const [tabelasMap, meta, fila] = await Promise.all([
      carregarTodasTabelasDoIndexedDb(),
      carregarMetaSincronizacao(),
      carregarFilaSincronizacao(),
    ]);
    const pendentes = fila.filter(estaPendente);
    const conflitos = fila.filter(i => i.status === 'CONFLITO');
    notifySyncStatusChange(meta ? {
      status: meta.status === 'SINCRONIZANDO' ? 'LOCAL' : meta.status,
      ultimaSincronizacao: meta.ultimaSincronizacao,
      ultimaLeituraSucesso: meta.ultimaLeituraSucesso,
      ultimaEscritaSucesso: meta.ultimaEscritaSucesso,
      pendentesCount: pendentes.length,
      conflitosCount: conflitos.length,
      erros: meta.erros || [],
      tabelasStatus: meta.tabelasStatus || {},
    } : { status: 'LOCAL', pendentesCount: pendentes.length, conflitosCount: conflitos.length });

    if (!tabelasMap || Object.keys(tabelasMap).length === 0) return { dados: null, meta, fila };
    // Normaliza também caches gravados por versões anteriores do app.
    return { dados: montarDadosBase(normalizarMapa(tabelasMap)), meta, fila };
  } catch (err) {
    console.error('Erro ao inicializar cache do IndexedDB:', err);
    return { dados: null, meta: null, fila: [] };
  }
}

/** 2. Lê a planilha inteira e atualiza a cópia do aparelho. */
async function sincronizarDaBaseOficialInterna(): Promise<{ sucesso: boolean; dados?: DadosBase; erro?: string }> {
  notifySyncStatusChange({ status: 'SINCRONIZANDO' });
  try {
    const token = await getAccessToken();
    if (!token) {
      notifySyncStatusChange({
        status: currentSyncState.ultimaSincronizacao ? 'LOCAL' : 'ERRO',
        erros: ['Conecte sua conta Google para sincronizar com a planilha.'],
      });
      return { sucesso: false, erro: 'Não autenticado no Google.' };
    }

    // Alterações locais são enviadas antes; o que continuar pendente não é sobrescrito.
    await processarFilaInterna();
    const pendentes = (await carregarFilaSincronizacao()).filter(i => estaPendente(i) || i.status === 'CONFLITO');
    const tabelasComPendencia = new Set(pendentes.map(i => i.tabela));
    const cacheAnterior = (await carregarTodasTabelasDoIndexedDb()) || {};
    const leitura = await carregarDadosDaPlanilhaOficial();

    const indisponiveis = TABELAS_ESSENCIAIS.filter(t => !leitura.tabelas[t]?.length);
    if (indisponiveis.length > 0) {
      const erro = `Não foi possível ler as abas essenciais da planilha: ${indisponiveis.join(', ')}.`;
      notifySyncStatusChange({ status: 'ERRO', erros: [erro] });
      return { sucesso: false, erro };
    }

    const tabelasStatus: SyncStatusState['tabelasStatus'] = {};
    const erros: string[] = [];
    const mapa: Record<string, any[]> = {};

    for (const tabela of TABELAS_LIDAS) {
      const anteriores = cacheAnterior[tabela] || [];
      const remotas = leitura.tabelas[tabela];
      if (tabelasComPendencia.has(tabela)) {
        mapa[tabela] = anteriores;
        tabelasStatus[tabela] = { ok: false, count: anteriores.length, error: 'Alterações deste aparelho aguardando envio.' };
      } else if (Array.isArray(remotas)) {
        mapa[tabela] = remotas;
        tabelasStatus[tabela] = { ok: true, count: remotas.length };
      } else if (leitura.ausentes.includes(tabela) && COLUNAS_DAS_ABAS_DO_APP[tabela]) {
        // Aba do app ainda não criada: será criada na primeira gravação.
        mapa[tabela] = anteriores;
        tabelasStatus[tabela] = { ok: true, count: anteriores.length };
      } else {
        mapa[tabela] = anteriores;
        tabelasStatus[tabela] = { ok: false, count: anteriores.length, error: 'Não lida nesta sincronização.' };
        erros.push(leitura.ausentes.includes(tabela)
          ? `A aba "${tabela}" não existe na planilha.`
          : `A aba "${tabela}" não pôde ser lida agora.`);
      }
    }

    await salvarTabelasNoIndexedDb(mapa);
    const agora = new Date().toISOString();
    const status: SyncStatusState['status'] = erros.length > 0 ? 'PARCIAL' : 'SINCRONIZADO';
    await salvarMetaSincronizacao({
      ultimaSincronizacao: agora,
      ultimaLeituraSucesso: agora,
      ultimaEscritaSucesso: currentSyncState.ultimaEscritaSucesso,
      status,
      erros,
      tabelasStatus,
    });
    notifySyncStatusChange({
      status: pendentes.length > 0 ? 'LOCAL' : status,
      ultimaSincronizacao: agora,
      ultimaLeituraSucesso: agora,
      erros,
      tabelasStatus,
      pendentesCount: pendentes.length,
    });
    return { sucesso: true, dados: montarDadosBase(mapa) };
  } catch (err: any) {
    console.error('Erro na sincronização da planilha oficial:', err);
    const msg = err?.message || 'Falha ao sincronizar com Google Sheets';
    notifySyncStatusChange({ status: currentSyncState.ultimaSincronizacao ? 'LOCAL' : 'ERRO', erros: [msg] });
    return { sucesso: false, erro: msg };
  }
}

export interface AlteracaoResiliente {
  tabela: string;
  tipo: SyncQueueOpTipo;
  registro: Record<string, any>;
  /** Para atualizações: grava apenas estes campos na planilha. */
  campos?: string[];
}

/**
 * 3. Salva alterações: primeiro no aparelho (garantido), depois tenta enviar à planilha.
 * gravadoOnline = a planilha confirmou; enfileiradoOffline = ficou para a próxima conexão.
 */
export function salvarAlteracoesResilientes(
  alteracoes: AlteracaoResiliente[]
): Promise<{ gravadoOnline: boolean; enfileiradoOffline: boolean }> {
  return exclusively(async () => {
    for (const a of alteracoes) {
      const validacao = validarEscritaTabela(a.tabela, a.registro, a.tipo);
      if (!validacao.valido) throw new Error(validacao.motivo);
    }
    const itens = await salvarAlteracoesAtomicas(
      alteracoes.map(a => ({ tabela: a.tabela, tipo: a.tipo, payload: a.registro, campos: a.campos }))
    );
    await processarFilaInterna();
    const fila = await carregarFilaSincronizacao();
    const pendente = itens.some(item => fila.some(f => f.id === item.id));
    return { gravadoOnline: !pendente, enfileiradoOffline: pendente };
  });
}

/**
 * Salva no aparelho (garantido, transação única) e envia à planilha em segundo plano.
 * A tela não espera a internet: o selo de sincronização mostra quando a planilha confirmou.
 */
export async function salvarEEnviarEmSegundoPlano(alteracoes: AlteracaoResiliente[]): Promise<void> {
  await exclusively(async () => {
    for (const a of alteracoes) {
      const validacao = validarEscritaTabela(a.tabela, a.registro, a.tipo);
      if (!validacao.valido) throw new Error(validacao.motivo);
    }
    await salvarAlteracoesAtomicas(
      alteracoes.map(a => ({ tabela: a.tabela, tipo: a.tipo, payload: a.registro, campos: a.campos }))
    );
    notifySyncStatusChange({ pendentesCount: currentSyncState.pendentesCount + alteracoes.length });
  });
  void processarFilaSincronizacao().catch(err => console.warn('Envio em segundo plano:', err));
}

export function salvarRegistroResiliente(
  tabela: string, tipo: SyncQueueOpTipo, registro: Record<string, any>, campos?: string[]
): Promise<{ gravadoOnline: boolean; enfileiradoOffline: boolean }> {
  return salvarAlteracoesResilientes([{ tabela, tipo, registro, campos }]);
}

export function sincronizarDaBaseOficial() {
  return exclusively(sincronizarDaBaseOficialInterna);
}

export function processarFilaSincronizacao() {
  return exclusively(processarFilaInterna);
}

/** Agrupa itens consecutivos da mesma aba (exceto exclusões) para gravar em lote. */
function agruparEmLotes(itens: SyncQueueItem[]): SyncQueueItem[][] {
  const lotes: SyncQueueItem[][] = [];
  for (const item of itens) {
    const atual = lotes[lotes.length - 1];
    const cabe = atual && item.tipo !== 'DELETE' && atual[0].tipo !== 'DELETE'
      && atual[0].tabela === item.tabela && atual.length < TAMANHO_MAX_LOTE;
    if (cabe) atual.push(item);
    else lotes.push([item]);
  }
  return lotes;
}

/** 4. Envia a fila à planilha, na ordem de criação. Para no primeiro erro para preservar a ordem. */
async function processarFilaInterna(): Promise<{ processados: number; erros: number; conflitos: number }> {
  const fila = await carregarFilaSincronizacao();
  const pendentes = fila
    .filter(estaPendente)
    .sort((a, b) => (a.seq ?? Date.parse(a.criado_em) * 1000) - (b.seq ?? Date.parse(b.criado_em) * 1000));

  if (pendentes.length === 0) {
    notifySyncStatusChange({ pendentesCount: 0 });
    return { processados: 0, erros: 0, conflitos: 0 };
  }
  if (!(await getAccessToken())) {
    notifySyncStatusChange({ status: 'LOCAL', pendentesCount: pendentes.length });
    return { processados: 0, erros: 0, conflitos: 0 };
  }

  let processados = 0;
  let erros = 0;
  for (const lote of agruparEmLotes(pendentes)) {
    try {
      for (const item of lote) {
        await atualizarItemFila(item.id, { status: 'SINCRONIZANDO', tentativas: item.tentativas + 1 });
      }
      if (lote[0].tipo === 'DELETE') {
        await removerRegistroDaPlanilhaOficial(lote[0].tabela, lote[0].payload);
      } else {
        await gravarLoteNaPlanilhaOficial(lote[0].tabela, lote.map(i => ({ registro: i.payload, campos: i.campos })));
      }
      for (const item of lote) await removerItemFilaConfirmado(item.id);
      processados += lote.length;
    } catch (err: any) {
      console.error(`Erro ao sincronizar ${lote.length} item(ns) de ${lote[0].tabela}:`, err);
      erros += lote.length;
      for (const item of lote) {
        await atualizarItemFila(item.id, { status: 'ERRO', erro: err?.message || 'Falha ao sincronizar com Google Sheets' });
      }
      notifySyncStatusChange({ erros: [err?.message || 'Falha ao enviar alterações para a planilha.'] });
      break;
    }
  }

  const restantes = (await carregarFilaSincronizacao()).filter(estaPendente);
  const agora = new Date().toISOString();
  notifySyncStatusChange({
    pendentesCount: restantes.length,
    ultimaEscritaSucesso: processados > 0 ? agora : currentSyncState.ultimaEscritaSucesso,
    status: restantes.length > 0 ? 'LOCAL' : currentSyncState.status === 'SINCRONIZANDO' ? 'SINCRONIZANDO' : 'SINCRONIZADO',
    ...(restantes.length === 0 && erros === 0 ? { erros: [] } : {}),
  });
  return { processados, erros, conflitos: 0 };
}
