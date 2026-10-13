/**
 * Ponta a ponta sem navegador: tela → fila local → /api/critical-write → coordenador → planilha simulada.
 * Prova que uma tabela que antes ia direto (orientacoes) agora passa por versão + log, e que um
 * segundo aparelho com versão antiga recebe conflito em vez de sobrescrever.
 */
import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
const { salvarRegistroResiliente, processarFilaSincronizacao } = await import('../services/syncService');
const { carregarFilaSincronizacao } = await import('../services/indexedDbService');
const { setMockToken } = await import('../services/googleSheetsService');
const { WriteCoordinator } = await import('../server/worker');

const abas: Record<string, any[][]> = {
  orientacoes: [['orientacao_id', 'matricula_id', 'descricao', 'status', 'data_orientacao'],
    ['o1', 'm1', 'combinar sigilo', 'ABERTA', '13/10/2026']],
};
const ok = (d: unknown) => ({ ok: true, status: 200, json: async () => d }) as Response;
const store = new Map<string, unknown>();
const coord = new WriteCoordinator({ storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => { store.set(k, v); } } } as any, {} as any);
let chamadasAoWorker = 0, escritasDiretas = 0;

globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input); const m = init?.method || 'GET';
  if (url.includes('/api/critical-write')) {
    chamadasAoWorker++;
    const r = await coord.fetch(new Request('https://i/w', { method: 'POST', headers: init!.headers as any, body: init!.body as string }));
    return { ok: r.ok, status: r.status, json: async () => r.json() } as Response;
  }
  const aba = decodeURIComponent(url).match(/values\/'([^'!]+)'/)?.[1];
  if (url.includes('fields=')) return ok({ sheets: Object.keys(abas).map(t => ({ properties: { title: t, sheetId: 1 } })) });
  if (url.endsWith(':batchUpdate') && !url.includes('/values:') && m === 'POST') {
    const a = JSON.parse(String(init!.body)).requests?.[0]?.addSheet; if (a) abas[a.properties.title] = []; return ok({});
  }
  if (url.includes('/values:batchUpdate')) {
    for (const p of JSON.parse(String(init!.body)).data) {
      const [, col, row] = p.range.match(/!([A-Z]+)(\d+)$/)!; abas.orientacoes[Number(row) - 1][col.charCodeAt(0) - 65] = p.values[0][0];
    } return ok({});
  }
  if (m === 'PUT' && aba) { abas[aba][0] = JSON.parse(String(init!.body)).values[0]; return ok({}); }
  if (url.includes(':append?') && aba) { (abas[aba] ??= []).push(JSON.parse(String(init!.body)).values[0]); if (aba === 'orientacoes') escritasDiretas++; return ok({}); }
  if (aba) return ok({ values: abas[aba] });
  throw new Error('inesperado ' + m + ' ' + url);
}) as typeof fetch;

setMockToken('ficticio');
const { salvarTabelasNoIndexedDb, carregarTodasTabelasDoIndexedDb } = await import('../services/indexedDbService');
// O aparelho A tem no cache a linha como o app a guarda (data em ISO), enquanto a planilha mostra 13/10/2026.
const baseA = { orientacao_id: 'o1', matricula_id: 'm1', descricao: 'combinar sigilo', status: 'ABERTA', data_orientacao: '2026-10-13' };
await salvarTabelasNoIndexedDb({ orientacoes: [baseA] });

// Edição normal: formato de data diferente não gera conflito falso.
const salvo = await salvarRegistroResiliente('orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CONCLUIDA' });
assert.equal(salvo.gravadoOnline, true, 'edição válida sincroniza na hora, sem conflito falso');
assert.equal(chamadasAoWorker, 1, 'a gravação passou pelo coordenador');
assert.equal(escritasDiretas, 0, 'nenhum append direto na tabela');
assert.equal(abas.orientacoes[1][3], 'CONCLUIDA', 'planilha atualizada');
assert.equal(abas.orientacoes[1][4], '13/10/2026', 'coluna não editada preservada como estava');
assert.equal((await carregarFilaSincronizacao()).length, 0, 'fila esvaziada só após confirmação');
assert.equal(abas.log_alteracoes?.length, 2, 'log criado com 1 alteração');
assert.equal(abas.log_alteracoes[1][4], 'o1');
assert.equal(abas.log_alteracoes[1][6], 'status');
assert(!abas.log_alteracoes[1].join('|').includes('combinar sigilo'));

// Aparelho B ainda tem a versão antiga (ABERTA) e tenta mudar o mesmo campo: conflito, sem sobrescrever.
await salvarTabelasNoIndexedDb({ orientacoes: [baseA] });
await assert.rejects(() => salvarRegistroResiliente('orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CANCELADA' }),
  /CONFLITO_VERSAO/, 'versão antiga é detectada como conflito e NÃO é mostrada como salva');
assert.equal(abas.orientacoes[1][3], 'CONCLUIDA', 'valor do outro aparelho preservado');
assert.equal(abas.log_alteracoes.length, 2, 'conflito não gera log de alteração');
assert.equal((await carregarFilaSincronizacao())[0].status, 'CONFLITO', 'edição fica preservada para revisão');
console.log('E1 integração: gravação coordenada com log, sem conflito falso de data, e conflito real detectado.');
