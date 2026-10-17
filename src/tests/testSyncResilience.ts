/**
 * Fila local -> Worker autenticado -> Sheets simulado, SEM token OAuth do Sheets.
 * Recuperação após interrupção, serialização, versão concorrente e falha do IndexedDB.
 */
import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
const { salvarRegistroResiliente, processarFilaSincronizacao, subscribeSyncStatus } = await import('../services/syncService');
const { carregarFilaSincronizacao, carregarTodasTabelasDoIndexedDb, atualizarItemFila, salvarTabelasNoIndexedDb } = await import('../services/indexedDbService');
const { clearAccessToken } = await import('../services/googleSheetsService');
const { limparCachePerfil } = await import('../services/escritaCoordenadaService');
const { criarContaServicoDeTeste } = await import('./ajudaContaServico');
const { criarAmbiente } = await import('./ajudaAmbiente');

clearAccessToken();
// Sem rede e sem identidade de sessão, a escrita vai para uma fila persistente.
await salvarRegistroResiliente('marcos_academicos', 'INSERT', {marco_id:'a1',matricula_id:'m1',texto:'primeira',status:'ABERTA'});
assert.equal((await carregarTodasTabelasDoIndexedDb())?.marcos_academicos[0].texto,'primeira');
assert.equal((await carregarFilaSincronizacao()).length,1);
await salvarRegistroResiliente('marcos_academicos','UPDATE',{marco_id:'a1',texto:'mais recente'});
assert.equal((await carregarFilaSincronizacao()).length,1,'edição local consolidada');
assert.equal((await carregarFilaSincronizacao())[0].payload.matricula_id,'m1');
await atualizarItemFila((await carregarFilaSincronizacao())[0].id,{status:'SINCRONIZANDO'});

// A conta de serviço permite publicar uma vez, mesmo após retomada/interleaving.
const cs=await criarContaServicoDeTeste();
const amb=await criarAmbiente({abas:{marcos_academicos:[['marco_id','matricula_id','texto','status']]},
  env:{GOOGLE_SERVICE_ACCOUNT_JSON:cs.json}});
limparCachePerfil();
await Promise.all([processarFilaSincronizacao(),processarFilaSincronizacao()]);
assert.equal(amb.abas.marcos_academicos.length,2,'sem duplicar a inserção');
assert.equal(amb.abas.marcos_academicos[1][2],'mais recente');
assert.equal((await carregarFilaSincronizacao()).length,0);
assert.equal(amb.abas.log_alteracoes?.length,2,'log gravado com identidade verificada');
assert(!amb.chamadas.some(c=>c.auth?.includes('token-google-do-usuario')),'OAuth do usuário não enviado');

// Sem OAuth, a última alteração chega ao Worker e o cache reflete a versão atual.
const online=await salvarRegistroResiliente('marcos_academicos','UPDATE',{marco_id:'a1',texto:'nova'});
assert.equal(online.gravadoOnline,true);
assert.equal(amb.abas.marcos_academicos[1][2],'nova');
assert.equal((await carregarTodasTabelasDoIndexedDb())?.marcos_academicos[0].texto,'nova');

// Versão local antiga: conflito explícito sem sobrescrever o conteúdo da planilha.
await salvarTabelasNoIndexedDb({marcos_academicos:[{marco_id:'a1',matricula_id:'m1',texto:'antiga',status:'ABERTA'}]});
await assert.rejects(()=>salvarRegistroResiliente('marcos_academicos','UPDATE',{marco_id:'a1',texto:'em conflito'}),/CONFLITO_VERSAO/);
assert.equal(amb.abas.marcos_academicos[1][2],'nova');
const conflito=(await carregarFilaSincronizacao())[0];
assert.equal(conflito.status,'CONFLITO');
let statusAtual: any=null;
const unsub=subscribeSyncStatus(next=>{statusAtual=next});
assert.equal((await processarFilaSincronizacao()).conflitos,1);
assert.equal(statusAtual.status,'PARCIAL');
assert.equal(statusAtual.conflitosCount,1);
await assert.rejects(()=>salvarRegistroResiliente('marcos_academicos','UPDATE',{marco_id:'a1',texto:'sobrescrever conflito'}),/conflito de sincronização/);
assert.equal((await carregarFilaSincronizacao()).length,1);
unsub();

// Falha persistente do armazenamento nunca pode ser anunciada como sucesso local.
(globalThis as any).window.indexedDB=undefined;
await assert.rejects(()=>salvarRegistroResiliente('marcos_academicos','INSERT',{marco_id:'a2'}),/IndexedDB/);
amb.restaurar();
console.log('[PASS] Login único e fila: cache atômico, retomada, reenvio único, CAS, conflito e falha de armazenamento.');
