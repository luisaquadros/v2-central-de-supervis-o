import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
const mem = new Map<string, string>();
Object.assign(globalThis, { window: { indexedDB }, localStorage: { removeItem:(k:string)=>mem.delete(k), getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } } });
const I = await import('../services/indexedDbService');

await I.salvarTabelasNoIndexedDb({ alunos: [{ aluno_id: 'a1' }], avaliacoes: [{ avaliacao_id: 'v1', nota: 8 }] });
assert.equal(await I.garantirCacheDoUsuario('uid-A'), 'LIMPO', 'cache sem proprietário é arquivado, nunca adotado silenciosamente');
assert(mem.has('cs_arquivo_conta:legado-sem-conta:cache_v1'));
await I.salvarTabelasNoIndexedDb({avaliacoes:[{avaliacao_id:'v1',nota:8}]});
assert.equal(await I.garantirCacheDoUsuario('uid-A'), 'MESMO');
assert.equal((await I.carregarTodasTabelasDoIndexedDb())?.avaliacoes.length, 1);

// Troca para outra conta sem pendências: a cópia local das tabelas é apagada (a nota não fica no aparelho)
assert.equal(await I.garantirCacheDoUsuario('uid-B'), 'LIMPO');
const apos = await I.carregarTodasTabelasDoIndexedDb();
assert(!apos || Object.values(apos).every(v => v.length === 0), 'tabelas apagadas');
assert.equal(await I.garantirCacheDoUsuario('uid-B'), 'MESMO');

// Com alterações pendentes de outra conta: nada é apagado e a troca é sinalizada
await I.salvarTabelasNoIndexedDb({ ocorrencias: [{ ocorrencia_id: 'o1' }] });
await I.salvarAlteracaoAtomica('ocorrencias', 'UPDATE', { ocorrencia_id: 'o1', status: 'X' });
assert.equal(await I.garantirCacheDoUsuario('uid-C'), 'PENDENTES_DE_OUTRA_CONTA');
assert.equal((await I.carregarFilaSincronizacao()).length, 1, 'fila preservada');
assert.equal((await I.carregarTodasTabelasDoIndexedDb())?.ocorrencias.length, 1, 'cache preservado enquanto há pendências');
assert.equal(await I.garantirCacheDoUsuario('uid-C'), 'PENDENTES_DE_OUTRA_CONTA', 'continua sinalizando; nunca adota a identidade de outra conta');
console.log('Cache local: limpeza na troca de usuária e preservação de pendências validadas.');
