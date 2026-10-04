/**
 * CENTRAL DE SUPERVISÃO - SERVIÇO DE CACHE LOCAL PERSISTENTE (IndexedDB)
 *
 * Hierarquia do Sistema:
 * 1. Google Sheets = Fonte Oficial da Verdade
 * 2. IndexedDB = Cópia Persistente de Trabalho
 * 3. syncQueue = Fila Persistente de Alterações Pendentes
 *
 * Garante que:
 * - O app abre instantaneamente com os dados da última sincronização
 * - A interface NUNCA zera após recompilações ou falhas temporárias de rede/OAuth
 * - Alterações offline/sem OAuth entram na fila persistente e não são perdidas
 */

export interface SyncMeta {
  ultimaSincronizacao: string | null;
  ultimaLeituraSucesso: string | null;
  ultimaEscritaSucesso: string | null;
  status: 'SINCRONIZADO' | 'LOCAL' | 'SINCRONIZANDO' | 'ERRO' | 'PARCIAL';
  erros: string[];
  tabelasStatus: Record<string, { ok: boolean; count: number; error?: string }>;
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
  erro?: string | null;
  versao_conflito?: Record<string, any>;
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
          result[key] = getReq.result || [];
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
 * Salva metadados de sincronização (horários, erros e status)
 */
export async function salvarMetaSincronizacao(meta: SyncMeta): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], 'readwrite');
    const store = tx.objectStore(STORE_META);
    store.put(meta, 'current_meta');
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
    req.onsuccess = () => resolve(req.result || []);
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
