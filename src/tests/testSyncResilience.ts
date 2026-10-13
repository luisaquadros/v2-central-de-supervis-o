import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
const { salvarRegistroResiliente, processarFilaSincronizacao, subscribeSyncStatus } = await import('../services/syncService');
const { carregarFilaSincronizacao, carregarTodasTabelasDoIndexedDb, atualizarItemFila } = await import('../services/indexedDbService');
const { setMockToken, clearAccessToken } = await import('../services/googleSheetsService');
let rows: any[][] = [['orientacao_id', 'matricula_id', 'texto', 'status']];
let writes = 0;
const ok = (body: any) => ({ ok: true, status: 200, json: async () => body }) as Response;
globalThis.fetch = (async (url: any, init?: RequestInit) => {
  const u = String(url);
  if (u.includes('fields=')) return ok({ sheets: [{properties: {title: 'orientacoes', sheetId: 1}}] });
  if (!init?.method) return ok({values: rows});
  const body = JSON.parse(String(init.body));
  if (init.method === 'POST' && u.includes(':append?')) { rows.push(body.values[0]); writes++; return ok({}); }
  if (init.method === 'PUT') { rows[1] = body.values[0]; writes++; return ok({}); }
  throw new Error('Unexpected write');
}) as typeof fetch;
clearAccessToken();
await salvarRegistroResiliente('orientacoes', 'INSERT', {orientacao_id:'o1',matricula_id:'m1',texto:'primeira',status:'ABERTA'});
assert.equal((await carregarTodasTabelasDoIndexedDb())?.orientacoes[0].texto, 'primeira');
assert.equal((await carregarFilaSincronizacao()).length, 1);
await salvarRegistroResiliente('orientacoes', 'UPDATE', {orientacao_id:'o1',texto:'mais recente'});
assert.equal((await carregarFilaSincronizacao()).length, 1);
assert.equal((await carregarFilaSincronizacao())[0].payload.matricula_id, 'm1');
// Resume an operation interrupted by closing the browser.
await atualizarItemFila((await carregarFilaSincronizacao())[0].id, {status:'SINCRONIZANDO'});
setMockToken('ficticio');
await Promise.all([processarFilaSincronizacao(), processarFilaSincronizacao()]);
assert.equal(writes, 1);
assert.equal(rows[1][2], 'mais recente');
assert.equal((await carregarFilaSincronizacao()).length, 0);
// A new online edit cannot be overwritten by an old queued version.
clearAccessToken();
await salvarRegistroResiliente('orientacoes', 'UPDATE', {orientacao_id:'o1',texto:'antiga'});
setMockToken('ficticio');
await salvarRegistroResiliente('orientacoes', 'UPDATE', {orientacao_id:'o1',texto:'nova'});
await processarFilaSincronizacao();
assert.equal(rows[1][2], 'nova');
assert.equal((await carregarTodasTabelasDoIndexedDb())?.orientacoes[0].texto, 'nova');
// Um conflito persistente não pode sumir da UI nem ser eliminado por outra edição.
clearAccessToken();
await salvarRegistroResiliente('orientacoes', 'UPDATE', {orientacao_id:'o1',texto:'em conflito'});
const conflito = (await carregarFilaSincronizacao())[0];
await atualizarItemFila(conflito.id, {status:'CONFLITO'});
let statusAtual: any = null;
const unsubscribe = subscribeSyncStatus(next => { statusAtual = next; });
const resultConflito = await processarFilaSincronizacao();
assert.equal(resultConflito.conflitos,1);
assert.equal(statusAtual.status,'PARCIAL');
assert.equal(statusAtual.conflitosCount,1);
await assert.rejects(() => salvarRegistroResiliente('orientacoes','UPDATE',
  {orientacao_id:'o1',texto:'tentativa de sobrescrever conflito'}), /conflito de sincronização/);
assert.equal((await carregarFilaSincronizacao()).length,1);
assert.equal((await carregarFilaSincronizacao())[0].status,'CONFLITO');
assert.equal((await carregarTodasTabelasDoIndexedDb())?.orientacoes[0].texto,'em conflito');
unsubscribe();

// Cache failure must reject: it must never report local save success.
clearAccessToken();
(globalThis as any).window.indexedDB = undefined;
await assert.rejects(() => salvarRegistroResiliente('orientacoes', 'INSERT', {orientacao_id:'o2'}), /IndexedDB/);
console.log('[PASS] Cache+outbox atomicity, offline edits, restart recovery, concurrent replay, latest edit and storage failure.');
