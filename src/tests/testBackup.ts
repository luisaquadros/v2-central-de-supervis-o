import { strict as assert } from 'node:assert';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { window: { indexedDB } });
import * as B from '../services/backupService';
const { salvarRegistroResiliente } = await import('../services/syncService');
const { salvarTabelasNoIndexedDb } = await import('../services/indexedDbService');
const { setMockToken } = await import('../services/googleSheetsService');
const { WriteCoordinator, default: worker } = await import('../server/worker');
const { definirProvedorIdToken } = await import('../services/escritaCoordenadaService');
const { criarEmissor, ehJwks } = await import('./ajudaAutorizacao');
const emissor = await criarEmissor();
definirProvedorIdToken(() => emissor.token('professora@exemplo.com'));

const tabelas: B.TabelasBackup = {
  alunos: [{ aluno_id: 'a1', nome: 'Estudante 1' }, { aluno_id: 'a2', nome: 'Estudante 2' }],
  turmas: [{ turma_id: 't1', nome: 'Turma 1' }],
  matriculas: [{ matricula_id: 'm1', aluno_id: 'a1', turma_id: 't1' }, { matricula_id: 'm2', aluno_id: 'a2', turma_id: 't1' }],
  orientacoes: [{ orientacao_id: 'o1', matricula_id: 'm1', descricao: 'texto', status: 'ABERTA', data_orientacao: '2026-10-13' }],
  entregas: [{ entrega_id: 'e1', matricula_id: 'm1', tipo_documento: 'MANUAL_ESTAGIO', status_entrega: 'ENTREGUE' }],
};

// 1) Backup íntegro passa; adulterado, com chave duplicada ou checksum errado falha
const arq = await B.gerarBackup(tabelas, new Date('2026-10-13T12:00:00Z'));
assert.equal(arq.version, '2.0'); assert.equal(arq.contagens.alunos, 2);
const r1 = await B.validarBackup(JSON.parse(JSON.stringify(arq)));
assert.equal(r1.ok, true); assert.deepEqual(r1.erros, []);
const adulterado = JSON.parse(JSON.stringify(arq)); adulterado.tables.alunos[0].nome = 'Outro';
assert.equal((await B.validarBackup(adulterado)).ok, false, 'conteúdo alterado é detectado pelo checksum');
const dup = JSON.parse(JSON.stringify(arq)); dup.tables.alunos.push({ aluno_id: 'a1', nome: 'x' }); dup.checksum = await B.checksumDeTabelas(dup.tables); dup.contagens.alunos = 3;
assert((await B.validarBackup(dup)).erros.some(e => /duplicada/.test(e)), 'chave duplicada');
const orfao = JSON.parse(JSON.stringify(arq)); orfao.tables.entregas.push({ entrega_id: 'e9', matricula_id: 'm404' }); orfao.checksum = await B.checksumDeTabelas(orfao.tables); orfao.contagens.entregas = 2;
assert((await B.validarBackup(orfao)).avisos.some(a => /entregas.*matriculas/.test(a)), 'referência quebrada vira aviso');
assert.equal((await B.validarBackup({ foo: 1 })).ok, false);
assert.equal((await B.validarBackup({ version: '1.2.1', tables: tabelas })).ok, true, 'versão antiga abre com aviso');

// 2) Comparação: diferente, ausente; registros novos de hoje NÃO viram exclusão
const hoje: B.TabelasBackup = JSON.parse(JSON.stringify(tabelas));
hoje.orientacoes[0].status = 'CONCLUIDA';                       // alterado depois do backup
hoje.entregas = [];                                              // sumiu
hoje.alunos.push({ aluno_id: 'a3', nome: 'Novo' });              // criado depois do backup
const dif = B.compararComBackup(tabelas, hoje);
assert.deepEqual(dif.map(d => `${d.tabela}:${d.tipo}`).sort(), ['entregas:AUSENTE_NO_ATUAL', 'orientacoes:DIFERENTE']);
assert.deepEqual(dif.find(d => d.tabela === 'orientacoes')!.campos, ['status']);
assert(!dif.some(d => d.id === 'a3'), 'trabalho novo nunca é proposto para apagar');
assert.equal(B.TABELAS_RESTAURAVEIS.includes('registros_semanais' as never), false, 'aba de fórmula não é restaurável');
const opU = B.operacaoDeRestauracao(dif.find(d => d.tabela === 'orientacoes')!);
assert.deepEqual(opU, { tipo: 'UPDATE', registro: { orientacao_id: 'o1', status: 'ABERTA' } }, 'UPDATE só dos campos que diferem');
assert.equal(B.operacaoDeRestauracao(dif.find(d => d.tabela === 'entregas')!).tipo, 'INSERT');

// 3) Restauração ponta a ponta em planilha simulada (isolada): fila → coordenador → log
const abas: Record<string, any[][]> = {
  orientacoes: [['orientacao_id', 'matricula_id', 'descricao', 'status', 'data_orientacao'], ['o1', 'm1', 'texto', 'CONCLUIDA', '13/10/2026']],
  entregas: [['entrega_id', 'matricula_id', 'tipo_entrega', 'status', 'data_envio']],
};
const ok = (d: unknown) => ({ ok: true, status: 200, json: async () => d }) as Response;
abas.matriculas=[['matricula_id'], ...[...new Set(tabelas.entregas.map(e=>e.matricula_id))].map(id=>[id])];
const store = new Map<string, unknown>();
const coord = new WriteCoordinator({ storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => { store.set(k, v); } } } as any, {} as any);
const envWorker: any = { ADMIN_EMAILS: 'professora@exemplo.com', ASSETS: { fetch: async () => new Response('') },
  WRITE_COORDINATOR: { idFromName: () => 'x', get: () => ({ fetch: (rq: Request) => coord.fetch(rq) }) } };
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input), m = init?.method || 'GET';
  if (ehJwks(url)) return ok(emissor.jwks);
  if (url.includes('/api/critical-write')) {
    const r = await worker.fetch(new Request('https://app.exemplo/api/critical-write', { method: 'POST', headers: init!.headers as any, body: init!.body as string }), envWorker);
    return { ok: r.ok, status: r.status, json: async () => r.json() } as Response;
  }
  const aba = decodeURIComponent(url).match(/values\/'([^'!]+)'/)?.[1];
  if (url.includes('fields=')) return ok({ sheets: Object.keys(abas).map(t => ({ properties: { title: t, sheetId: 1 } })) });
  if (url.endsWith(':batchUpdate') && !url.includes('/values:') && m === 'POST') { const a = JSON.parse(String(init!.body)).requests?.[0]?.addSheet; if (a) abas[a.properties.title] = []; return ok({}); }
  if (url.includes('/values:batchUpdate')) {
    for (const p of JSON.parse(String(init!.body)).data) { const [, c, row] = p.range.match(/!([A-Z]+)(\d+)$/)!; abas.orientacoes[Number(row) - 1][c.charCodeAt(0) - 65] = p.values[0][0]; }
    return ok({});
  }
  if (m === 'PUT' && aba) { abas[aba][0] = JSON.parse(String(init!.body)).values[0]; return ok({}); }
  if (url.includes(':append?') && aba) { (abas[aba] ??= []).push(JSON.parse(String(init!.body)).values[0]); return ok({}); }
  if (aba) return ok({ values: abas[aba] });
  throw new Error('inesperado ' + m + ' ' + url);
}) as typeof fetch;
setMockToken('ficticio');
await salvarTabelasNoIndexedDb({ orientacoes: hoje.orientacoes, entregas: [] });   // estado atual do aparelho

for (const d of dif) {
  const op = B.operacaoDeRestauracao(d);
  await salvarRegistroResiliente(d.tabela, op.tipo, op.registro);
}
assert.equal(abas.orientacoes[1][3], 'ABERTA', 'campo restaurado');
assert.equal(abas.orientacoes[1][4], '13/10/2026', 'demais colunas intactas');
assert.equal(abas.entregas.length, 2, 'registro ausente reinserido');
assert.equal(abas.entregas[1][0], 'e1');
const log = abas.log_alteracoes;
assert.deepEqual(log.slice(1).map(l => `${l[3]}:${l[5]}`).sort(), ['entregas:INSERT', 'orientacoes:UPDATE'], 'cada restauração deixa trilha');
// Depois de restaurar, nada mais difere
const apos: B.TabelasBackup = { ...hoje, orientacoes: [{ ...hoje.orientacoes[0], status: 'ABERTA' }], entregas: tabelas.entregas };
assert.equal(B.compararComBackup(tabelas, apos).length, 0);
console.log('Backup: checksum, integridade, comparação e restauração por registro (com log) validados.');
