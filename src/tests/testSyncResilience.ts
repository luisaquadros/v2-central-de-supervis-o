import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
const { salvarRegistroResiliente, processarFilaSincronizacao, subscribeSyncStatus } = await import('../services/syncService');
const { carregarFilaSincronizacao, carregarTodasTabelasDoIndexedDb, atualizarItemFila } = await import('../services/indexedDbService');
const { setMockToken, clearAccessToken } = await import('../services/googleSheetsService');
const {criarAmbiente}=await import('./ajudaAmbiente');
const rows:any[][]=[['marco_id','matricula_id','texto','status']];
const amb=await criarAmbiente({abas:{marcos_academicos:rows,matriculas:[['matricula_id'],['m1']]}});
const contarEscritas=()=>amb.chamadas.filter(c=>c.metodo==='POST'&&(c.url.includes('/values:batchUpdate')||c.url.includes('marcos_academicos')&&c.url.includes(':append?'))).length;
clearAccessToken();
await salvarRegistroResiliente('marcos_academicos', 'INSERT', {marco_id:'a1',matricula_id:'m1',texto:'primeira',status:'ABERTA'});
assert.equal((await carregarTodasTabelasDoIndexedDb())?.marcos_academicos[0].texto, 'primeira');
assert.equal((await carregarFilaSincronizacao()).length, 1);
await salvarRegistroResiliente('marcos_academicos', 'UPDATE', {marco_id:'a1',texto:'mais recente'});
assert.equal((await carregarFilaSincronizacao()).length, 1);
assert.equal((await carregarFilaSincronizacao())[0].payload.matricula_id, 'm1');
// Todas as tabelas editáveis passam pelo Worker; teste com handler real e Sheets simulado.
// Resume an operation interrupted by closing the browser.
await atualizarItemFila((await carregarFilaSincronizacao())[0].id, {status:'SINCRONIZANDO'});
setMockToken('ficticio');
await Promise.all([processarFilaSincronizacao(), processarFilaSincronizacao()]);
assert.equal(contarEscritas(), 1);
assert.equal(rows[1][2], 'mais recente');
assert.equal((await carregarFilaSincronizacao()).length, 0);
// A new online edit cannot be overwritten by an old queued version.
clearAccessToken();
await salvarRegistroResiliente('marcos_academicos', 'UPDATE', {marco_id:'a1',texto:'antiga'});
setMockToken('ficticio');
await salvarRegistroResiliente('marcos_academicos', 'UPDATE', {marco_id:'a1',texto:'nova'});
await processarFilaSincronizacao();
assert.equal(rows[1][2], 'nova');
assert.equal((await carregarTodasTabelasDoIndexedDb())?.marcos_academicos[0].texto, 'nova');
// Um conflito persistente não pode sumir da UI nem ser eliminado por outra edição.
clearAccessToken();
await salvarRegistroResiliente('marcos_academicos', 'UPDATE', {marco_id:'a1',texto:'em conflito'});
const conflito = (await carregarFilaSincronizacao())[0];
await atualizarItemFila(conflito.id, {status:'CONFLITO'});
let statusAtual: any = null;
const unsubscribe = subscribeSyncStatus(next => { statusAtual = next; });
const resultConflito = await processarFilaSincronizacao();
assert.equal(resultConflito.conflitos,1);
assert.equal(statusAtual.status,'PARCIAL');
assert.equal(statusAtual.conflitosCount,1);
await assert.rejects(() => salvarRegistroResiliente('marcos_academicos','UPDATE',
  {marco_id:'a1',texto:'tentativa de sobrescrever conflito'}), /conflito de sincronização/);
assert.equal((await carregarFilaSincronizacao()).length,1);
assert.equal((await carregarFilaSincronizacao())[0].status,'CONFLITO');
assert.equal((await carregarTodasTabelasDoIndexedDb())?.marcos_academicos[0].texto,'em conflito');
unsubscribe();

// Cache failure must reject: it must never report local save success.
clearAccessToken();
(globalThis as any).window.indexedDB = undefined;
await assert.rejects(() => salvarRegistroResiliente('marcos_academicos', 'INSERT', {marco_id:'a2'}), /IndexedDB/);
console.log('[PASS] Cache+outbox atomicity, offline edits, restart recovery, concurrent replay, latest edit and storage failure.');

amb.restaurar();
