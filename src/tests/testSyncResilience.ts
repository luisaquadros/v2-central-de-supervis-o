import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
import { criarPlanilhaFalsa } from './planilhaFalsa';
Object.assign(globalThis, { window: { indexedDB } });
const { salvarRegistroResiliente, salvarAlteracoesResilientes, processarFilaSincronizacao } = await import('../services/syncService');
const { carregarFilaSincronizacao, carregarTodasTabelasDoIndexedDb, atualizarItemFila } = await import('../services/indexedDbService');
const { setMockToken, clearAccessToken } = await import('../services/googleSheetsService');

const planilha = criarPlanilhaFalsa({
  orientacoes: [['orientacao_id', 'matricula_id', 'texto', 'status']],
  frequencias: [['frequencia_id', 'matricula_id', 'data_aula', 'status']],
});
globalThis.fetch = planilha.fetchFalso;
const escritas = () => planilha.chamadas.filter(c => c.method === 'POST').length;

// Sem internet/login: salva no aparelho e enfileira.
clearAccessToken();
await salvarRegistroResiliente('orientacoes', 'INSERT', { orientacao_id: 'o1', matricula_id: 'm1', texto: 'primeira', status: 'ABERTA' });
assert.equal((await carregarTodasTabelasDoIndexedDb())?.orientacoes[0].texto, 'primeira');
assert.equal((await carregarFilaSincronizacao()).length, 1);
await salvarRegistroResiliente('orientacoes', 'UPDATE', { orientacao_id: 'o1', texto: 'mais recente' });
const fila = await carregarFilaSincronizacao();
assert.equal(fila.length, 1, 'versões do mesmo registro são consolidadas');
assert.equal(fila[0].payload.matricula_id, 'm1');
assert.equal(fila[0].tipo, 'INSERT', 'registro ainda não enviado continua sendo inserção completa');

// Retoma operação interrompida (navegador fechado no meio do envio) sem duplicar.
await atualizarItemFila(fila[0].id, { status: 'SINCRONIZANDO' });
setMockToken('ficticio');
await Promise.all([processarFilaSincronizacao(), processarFilaSincronizacao()]);
assert.equal(planilha.linhas('orientacoes').length, 2, 'uma única linha gravada');
assert.equal(planilha.linhas('orientacoes')[1][2], 'mais recente');
assert.equal((await carregarFilaSincronizacao()).length, 0);

// Uma edição nova não pode ser sobrescrita por uma versão antiga da fila.
clearAccessToken();
await salvarRegistroResiliente('orientacoes', 'UPDATE', { orientacao_id: 'o1', texto: 'antiga' });
setMockToken('ficticio');
await salvarRegistroResiliente('orientacoes', 'UPDATE', { orientacao_id: 'o1', texto: 'nova' });
await processarFilaSincronizacao();
assert.equal(planilha.linhas('orientacoes')[1][2], 'nova');
assert.equal((await carregarTodasTabelasDoIndexedDb())?.orientacoes[0].texto, 'nova');

// Ordem preservada e chamada inteira enviada em lote único.
clearAccessToken();
await salvarAlteracoesResilientes(Array.from({ length: 15 }, (_, i) => ({
  tabela: 'frequencias', tipo: 'INSERT' as const,
  registro: { frequencia_id: `f${i}`, matricula_id: `m${i}`, data_aula: '2026-10-13', status: 'PRESENTE' },
})));
await salvarRegistroResiliente('orientacoes', 'UPDATE', { orientacao_id: 'o1', status: 'CONCLUÍDA' }, ['status']);
setMockToken('ficticio');
const antes = escritas();
await processarFilaSincronizacao();
assert.equal(escritas() - antes, 2, '15 frequências em 1 append + 1 atualização de célula');
assert.equal(planilha.linhas('frequencias').length, 16);
assert.equal(planilha.linhas('orientacoes')[1][3], 'CONCLUÍDA');
assert.equal(planilha.linhas('orientacoes')[1][2], 'nova', 'campo não listado não é reescrito');

// Aba somente leitura é recusada antes de entrar na fila.
await assert.rejects(() => salvarRegistroResiliente('registros_semanais', 'UPDATE', { registro_id: 'r1' }), /somente leitura/);

// Falha do armazenamento local deve rejeitar: nunca anunciar "salvo" sem salvar.
clearAccessToken();
(globalThis as any).window.indexedDB = undefined;
await assert.rejects(() => salvarRegistroResiliente('orientacoes', 'INSERT', { orientacao_id: 'o2', texto: 'x' }), /IndexedDB/);
console.log('[PASS] Fila local: atomicidade, offline, retomada, concorrência, ordem, lote, campos e falha de armazenamento.');
