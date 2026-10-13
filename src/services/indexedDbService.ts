import { recordIdentity } from './recordIdentity';
/**
 * CENTRAL DE SUPERVISÃO - SERVIÇO DE CACHE LOCAL PERSISTENTE (IndexedDB)
 *
 * Hierarquia do Sistema:
 * 1. Google Sheets = Fonte Oficial da Verdade
 * 2. IndexedDB = Cópia Persistente de Trabalho
 * 3. syncQueue = Fila Persistente de Alterações Pendentes
 *
 * Versionamento explícito:
 * - CURRENT_CACHE_SCHEMA_VERSION = 2
 * - Valida integridade e compatibilidade dos schemas das tabelas locais
 * - Invalida apenas tabelas incompatíveis (ex: calendario_rss legado sem sequencia)
 * - Preserva tabelas locais válidas sem limpar a base inteira
 */

export const CURRENT_CACHE_SCHEMA_VERSION = 2;

export interface SyncMeta {
  ultimaSincronizacao: string | null;
  ultimaLeituraSucesso: string | null;
  ultimaEscritaSucesso: string | null;
  status: 'SINCRONIZADO' | 'LOCAL' | 'SINCRONIZANDO' | 'ERRO' | 'PARCIAL';
  erros: string[];
  tabelasStatus: Record<string, { ok: boolean; count: number; error?: string }>;
  cache_schema_version?: number;
}

export type SyncQueueOpTipo = 'INSERT' | 'UPDATE' | 'DELETE';
export type SyncQueueItemStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO' | 'CONFLITO';

export interface SyncQueueItem {
  id: string; // ID estável
  tabela: string; // Tabela normalizada de destino
  tipo: SyncQueueOpTipo;
  payload: Record<string, any>;
  criado_em: string;
  status: SyncQueueItemStatus;
  tentativas: number;
  sequencia?: number;
  cancelada?: boolean;
  usuario_uid?: string;
  erro?: string | null;
  versao_conflito?: Record<string, any>;
  versao_base?: Record<string, any> | null;
}

const DB_NAME = 'CentralSupervisao_DB_v1';
const DB_VERSION = 1;
const STORE_TABELAS = 'tabelas_normalizadas';
const STORE_META = 'sync_meta';
const STORE_QUEUE = 'sync_queue';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste navegador.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TABELAS)) {
        db.createObjectStore(STORE_TABELAS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('criado_em', 'criado_em', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Validação rigorosa de compatibilidade por tabela com o schema v2 da base oficial
 */
function isTabelaCompativel(tabela: string, rows: any[]): { compativel: boolean; motivo?: string } {
  if (!Array.isArray(rows) || rows.length === 0) return { compativel: true };
  const first = rows[0];
  if (!first || typeof first !== 'object') {
    return { compativel: false, motivo: 'Registro não é um objeto válido.' };
  }

  // Validação específica de calendario_rss (deve usar sequencia, semana_inicio, etc.)
  if (tabela === 'calendario_rss') {
    const hasValidKey = 'sequencia' in first || 'semana_inicio' in first || 'rss_previsto_id' in first;
    if (!hasValidKey) {
      return { compativel: false, motivo: 'Schema legado de calendario_rss sem campos oficiais (sequencia / semana_inicio).' };
    }
  }

  // Validação específica de status_rss_unidades (deve usar unidade_id, status_rss, etc.)
  if (tabela === 'status_rss_unidades') {
    const hasValidKey = 'unidade_id' in first || 'status_rss' in first || 'rss_esperados_ate_hoje' in first;
    if (!hasValidKey) {
      return { compativel: false, motivo: 'Schema legado de status_rss_unidades sem campos oficiais (unidade_id / status_rss).' };
    }
  }

  // Validação específica de situacao_atual_turmas (deve usar turma_id e campos oficiais)
  if (tabela === 'situacao_atual_turmas') {
    const hasValidKey = 'turma_id' in first && ('turma_nome' in first || 'rss_total_previsto' in first || 'unidade_rss' in first || 'aula_cronograma_atual' in first);
    if (!hasValidKey && ('situacao' in first || 'total_pendencias' in first)) {
      return { compativel: false, motivo: 'Schema obsoleto de situacao_atual_turmas com colunas inventadas.' };
    }
  }

  // Validação de configuracoes (deve ter chave e valor)
  if (tabela === 'configuracoes') {
    if (!('chave' in first)) {
      return { compativel: false, motivo: 'Tabela configuracoes sem coluna chave.' };
    }
  }

  // Validação de criterios_avaliacao
  if (tabela === 'criterios_avaliacao') {
    if (!('criterio_id' in first) && !('nome' in first)) {
      return { compativel: false, motivo: 'Tabela criterios_avaliacao sem identificador ou nome.' };
    }
  }

  return { compativel: true };
}

/**
 * Invalida/remove uma tabela incompatível do cache persistente
 */
export async function invalidarTabelaNoIndexedDb(tabela: string, motivo: string): Promise<void> {
  console.warn(`[CACHE_SCHEMA_V${CURRENT_CACHE_SCHEMA_VERSION}] Invalidando tabela "${tabela}" no IndexedDB. Motivo: ${motivo}`);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_TABELAS], 'readwrite');
      const store = tx.objectStore(STORE_TABELAS);
      store.delete(tabela);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error(`Erro ao invalidar tabela ${tabela} no IndexedDB:`, err);
  }
}

const CHAVE_UID_CACHE = 'cs_cache_uid';
/** Apaga a cópia local das tabelas e os metadados; NUNCA a fila de alterações pendentes. */
export async function limparTabelasDoCache(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_TABELAS, STORE_META], 'readwrite');
    tx.objectStore(STORE_TABELAS).clear(); tx.objectStore(STORE_META).delete('current_meta');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
/**
 * O cache pertence ao NAVEGADOR, não à conta. Na troca de usuário a cópia local das tabelas (que pode conter
 * dados que a nova conta não pode ver) é apagada. Se houver alterações pendentes da conta anterior, nada é apagado
 * e a troca é sinalizada: elas não devem ser enviadas com a identidade de outra pessoa.
 */
export async function garantirCacheDoUsuario(uid: string): Promise<'MESMO' | 'LIMPO' | 'PENDENTES_DE_OUTRA_CONTA'> {
  let anterior: string | null = null;
  try { anterior = localStorage.getItem(CHAVE_UID_CACHE); } catch { /* sem localStorage */ }
  if (anterior === uid) return 'MESMO';
  {
    if ((await carregarFilaSincronizacao()).length > 0) return 'PENDENTES_DE_OUTRA_CONTA';
    const origem=anterior || 'legado-sem-conta';
    const snapshot=await carregarTodasTabelasDoIndexedDb();
    if(snapshot) localStorage.setItem('cs_arquivo_conta:'+origem+':cache_v1',JSON.stringify(snapshot));
    await limparTabelasDoCache();
    // Arquivar dados auxiliares antes de retirar a cópia visível da conta anterior.
    for (const key of ['cs_avaliacoes_completas_v1','cs_caixa_entrada_v1','cs_fila_professora_v1','cs_fila_supervisao_v1','cs_encontros_turma_v2']) {
      const raw = localStorage.getItem(key);
      if (raw !== null) localStorage.setItem('cs_arquivo_conta:' + origem + ':' + key, raw);
      localStorage.removeItem(key);
    }
    if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('cs:account-changed'));
  }
  try { localStorage.setItem(CHAVE_UID_CACHE, uid); } catch { /* ignora */ }
  return 'LIMPO';
}

/**
 * Salva múltiplas tabelas normalizadas no cache persistente do IndexedDB
 */
export async function salvarTabelasNoIndexedDb(dadosTabelas: Record<string, any[]>): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TABELAS], 'readwrite');
    const store = tx.objectStore(STORE_TABELAS);

    Object.entries(dadosTabelas).forEach(([tabela, rows]) => {
      if (Array.isArray(rows)) {
        store.put(rows, tabela);
      }
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Salva ou atualiza uma única tabela normalizada no IndexedDB
 */
export async function salvarTabelaUnicaNoIndexedDb(tabela: string, rows: any[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TABELAS], 'readwrite');
    const store = tx.objectStore(STORE_TABELAS);
    store.put(rows, tabela);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Carrega todas as tabelas normalizadas armazenadas no IndexedDB
 * Valida a compatibilidade de schema: descarta e remove de forma controlada apenas tabelas incompatíveis
 */
export async function carregarTodasTabelasDoIndexedDb(): Promise<Record<string, any[]> | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TABELAS], 'readonly');
    const store = tx.objectStore(STORE_TABELAS);

    const getAllKeysReq = store.getAllKeys();

    getAllKeysReq.onsuccess = () => {
      const keys = getAllKeysReq.result as string[];
      if (!keys || keys.length === 0) {
        resolve(null);
        return;
      }

      const result: Record<string, any[]> = {};
      let pending = keys.length;

      keys.forEach((key) => {
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          const rows = getReq.result || [];
          const check = isTabelaCompativel(key, rows);
          if (check.compativel) {
            result[key] = rows;
          } else {
            console.warn(`[CACHE_INVALIDATION] Tabela "${key}" incompatível no cache. ${check.motivo}`);
            // Agenda remoção assíncrona da tabela incompatível
            invalidarTabelaNoIndexedDb(key, check.motivo || 'Incompatível com schema oficial');
          }
          pending--;
          if (pending === 0) {
            resolve(result);
          }
        };
        getReq.onerror = () => reject(getReq.error);
      });
    };

    getAllKeysReq.onerror = () => reject(getAllKeysReq.error);
  });
}

/**
 * Salva metadados de sincronização com carimbo explícito de cache_schema_version
 */
export async function salvarMetaSincronizacao(meta: SyncMeta): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], 'readwrite');
    const store = tx.objectStore(STORE_META);
    const metaComVersao: SyncMeta = {
      ...meta,
      cache_schema_version: CURRENT_CACHE_SCHEMA_VERSION,
    };
    store.put(metaComVersao, 'current_meta');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Carrega os metadados da última sincronização
 */
export async function carregarMetaSincronizacao(): Promise<SyncMeta | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get('current_meta');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Enfileira uma alteração local não sincronizada (syncQueue)
 */
export async function enfileirarAlteracaoLocal(item: {
  id: string;
  tabela: string;
  tipo: SyncQueueOpTipo;
  payload: Record<string, any>;
}): Promise<SyncQueueItem> {
  const db = await openDatabase();
  const queueItem: SyncQueueItem = {
    ...item,
    criado_em: new Date().toISOString(),
    status: 'PENDENTE',
    tentativas: 0,
    erro: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    store.put(queueItem);
    tx.oncomplete = () => resolve(queueItem);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Obtém todos os itens da fila de sincronização
 */
export async function carregarFilaSincronizacao(): Promise<SyncQueueItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], 'readonly');
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a: SyncQueueItem, b: SyncQueueItem) => (a.sequencia ?? 0) - (b.sequencia ?? 0) || a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id)));
    req.onerror = () => reject(req.error);
  });
}

/**
 * Atualiza um item da fila (ex: status, tentativas, erro ou conflito)
 */
export async function atualizarItemFila(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) {
        resolve();
        return;
      }
      const updated = { ...item, ...updates };
      store.put(updated);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove um item da fila somente após confirmação real da escrita no Sheets
 */
export async function removerItemFilaConfirmado(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Commit cache and outbox together: a reported local save must survive reload. */
export async function salvarAlteracaoAtomica(
  tabela: string, tipo: SyncQueueOpTipo, payload: Record<string, any>
): Promise<SyncQueueItem> {
  const db = await openDatabase();
  const identity = recordIdentity(tabela, payload);
  const item: SyncQueueItem = {
    id: crypto.randomUUID(), tabela, tipo, payload,
    criado_em: new Date().toISOString(), status: 'PENDENTE', tentativas: 0,
  };
  try { item.usuario_uid=localStorage.getItem(CHAVE_UID_CACHE) || undefined; } catch {}
  return new Promise((resolve, reject) => {
    let erroConflito: Error | null = null;
    const tx = db.transaction([STORE_TABELAS, STORE_QUEUE, STORE_META], 'readwrite');
    const seqReq=tx.objectStore(STORE_META).get('queue-sequence');
    seqReq.onsuccess=()=>{item.sequencia=Number(seqReq.result||0)+1;tx.objectStore(STORE_META).put(item.sequencia,'queue-sequence');};
    const tables = tx.objectStore(STORE_TABELAS);
    const queue = tx.objectStore(STORE_QUEUE);
    const req = tables.get(tabela);
    req.onsuccess = () => {
      const rows: any[] = req.result || [];
      const matches = (r: any) => {
        try { return recordIdentity(tabela, r) === identity; } catch { return false; }
      };
      const old = rows.find(matches);
      // Snapshot anterior ao primeiro ajuste; necessário para detectar edição obsoleta
      // quando outro dispositivo já alterou a versão na base oficial.
      item.versao_base = old ? JSON.parse(JSON.stringify(old)) : null;
      tables.put(tipo === 'DELETE' ? rows.filter(r => !matches(r)) :
        [...rows.filter(r => !matches(r)), { ...old, ...payload }], tabela);
      // Coalesce pending versions of this record while holding the sync lock.
      const pending = queue.getAll();
      pending.onsuccess = () => {
        for (const prior of pending.result as SyncQueueItem[]) {
          if (prior.tabela === tabela && matches(prior.payload)) {
            if (prior.status === 'CONFLITO') {
              erroConflito = new Error('Este registro tem um conflito de sincronização não resolvido. A edição foi cancelada sem apagar o registro local.');
              tx.abort(); // Desfaz também a alteração provisória da tabela local.
              return;
            }
            // Uma operação enviada pode ter sido aplicada: conservar ID e conteúdo até confirmação.
            if (prior.tentativas > 0) continue;
            item.sequencia=prior.sequencia ?? item.sequencia;
            item.criado_em=prior.criado_em;
            if(prior.tipo==='INSERT' && prior.versao_base==null && tipo==='DELETE') {
              queue.delete(prior.id); item.cancelada=true; continue;
            }
            // Múltiplas edições locais preservam a versão mais antiga ainda não enviada.
            item.versao_base = prior.versao_base ?? null;
            if (prior.tipo === 'INSERT' && tipo !== 'DELETE') item.tipo = 'INSERT';
            if (tipo !== 'DELETE' && prior.tipo !== 'DELETE') item.payload = { ...prior.payload, ...item.payload };
            queue.delete(prior.id);
          }
        }
        if(!item.cancelada) queue.put(item);
      };
    };
    tx.oncomplete = () => { db.close(); resolve(item); };
    tx.onerror = tx.onabort = () => { db.close(); reject(erroConflito || tx.error || new Error('Falha ao salvar no dispositivo.')); };
  });
}

/** Arquiva a edição em conflito e adota o registro remoto na mesma transação. */
export async function resolverItemConflito(item: SyncQueueItem, remoto: Record<string,unknown> | null): Promise<void> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([STORE_TABELAS,STORE_QUEUE,STORE_META],'readwrite');
    const queue=tx.objectStore(STORE_QUEUE), tables=tx.objectStore(STORE_TABELAS);
    const existing=queue.get(item.id);
    existing.onsuccess=()=>{
      if(existing.result?.status!=='CONFLITO'){tx.abort();return;}
      tx.objectStore(STORE_META).put({item:existing.result,usuario_uid:item.usuario_uid,arquivado_em:new Date().toISOString()},'conflito-arquivado:'+item.id);
      const req=tables.get(item.tabela);
      req.onsuccess=()=>{
        const rows=(req.result||[]).filter((r: Record<string,unknown>)=>recordIdentity(item.tabela,r)!==recordIdentity(item.tabela,item.payload));
        tables.put(remoto?[...rows,remoto]:rows,item.tabela);queue.delete(item.id);
      };
    };
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Conflito mudou durante a revisão.'));};
  });
}

export async function carregarRecuperacoesDoUsuario(uid: string): Promise<unknown[]> {
  if(!uid)return [];
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_META,'readonly');
    const req=tx.objectStore(STORE_META).getAll();
    req.onsuccess=()=>resolve(req.result.filter(v=>v?.usuario_uid===uid && v.item));
    tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
