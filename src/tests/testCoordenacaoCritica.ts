import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { adaptarRegistroCritico, compararVersaoDeCampos, idCritico, TABELAS_CRITICAS } from '../server/coordenacaoCritica';
Object.assign(globalThis,{window:{indexedDB}});
const {salvarAlteracaoAtomica,carregarFilaSincronizacao,carregarTodasTabelasDoIndexedDb,salvarTabelaUnicaNoIndexedDb}=await import('../services/indexedDbService');

assert(TABELAS_CRITICAS.has('frequencias'));
assert.equal(idCritico('frequencias',{matricula_id:'m1',data_aula:'2026-10-13'}),'["m1","2026-10-13"]');
assert.equal(adaptarRegistroCritico('frequencias',{status:'PRESENTE',atraso:true}).status,'ATRASO');
assert.deepEqual(compararVersaoDeCampos('avaliacoes',{avaliacao_id:'a1',nota:7},{avaliacao_id:'a1',nota:5},{avaliacao_id:'a1',nota:'5'},['avaliacao_id','nota'],'UPDATE'),[]);
assert.deepEqual(compararVersaoDeCampos('avaliacoes',{avaliacao_id:'a1',nota:7},{avaliacao_id:'a1',nota:5},{avaliacao_id:'a1',nota:'6'},['avaliacao_id','nota'],'UPDATE'),['nota']);
assert.deepEqual(compararVersaoDeCampos('avaliacoes',{avaliacao_id:'a1',nota:7},null,{avaliacao_id:'a1',nota:6},['avaliacao_id','nota'],'UPDATE'),['versão original indisponível']);
assert.deepEqual(compararVersaoDeCampos('avaliacoes',{avaliacao_id:'a1',nota:7},null,{avaliacao_id:'a1'},['avaliacao_id','nota'],'INSERT'),['registro já existe']);

await salvarTabelaUnicaNoIndexedDb('avaliacoes',[{avaliacao_id:'a1',matricula_id:'m1',nota:5}]);
const item=await salvarAlteracaoAtomica('avaliacoes','UPDATE',{avaliacao_id:'a1',nota:7});
assert.equal(item.versao_base?.nota,5);
await salvarAlteracaoAtomica('avaliacoes','UPDATE',{avaliacao_id:'a1',nota:8});
const fila=await carregarFilaSincronizacao();
assert.equal(fila.length,1);
assert.equal(fila[0].versao_base?.nota,5,'A versão inicial da fila não pode ser sobrescrita pela segunda edição');
assert.equal(fila[0].payload.nota,8);
assert.equal((await carregarTodasTabelasDoIndexedDb())?.avaliacoes[0].nota,8);
console.log('CAS: diferenças de versão, snapshot imutável e fusão offline validados.');
