import assert from 'node:assert/strict';
import { gerarSugestoesRss, resumirSemEnvioRss, textoSignificativo } from '../services/sugestoesAulaService';

// Respostas vazias de formulário não contam como relato.
for (const vazio of ['', 'Não', 'não.', 'Nenhuma', 'nenhum', 'Sem dúvidas', 'sem duvidas no momento', 'N/A', '-', 'Não há', 'Não houve']) {
  assert.equal(textoSignificativo(vazio), false, `vazio: "${vazio}"`);
}
for (const real of ['Dificuldade em manejar a ansiedade da criança na sessão', 'Como lidar com a resistência do paciente?']) {
  assert.equal(textoSignificativo(real), true, `real: "${real}"`);
}

const reg = (id: string, turma: string, data: string, extra: Record<string, unknown>) =>
  ({ registro_id: id, turma_id: turma, data_entrega: data, matricula_id: '', status: 'RECEBIDO', ...extra }) as any;
const registros = [
  reg('r1', 't1', '2026-10-08', { matricula_id: 'm1', duvidas_supervisao: 'Como manejar a resistência ao tratamento?', prioridade_supervisao: 'Sim: risco de abandono' }),
  reg('r2', 't1', '2026-10-09', { matricula_id: 'm2', duvidas_supervisao: 'Resistência da família e vínculo terapêutico', prioridade_supervisao: 'Não' }),
  reg('r3', 't1', '2026-10-10', { matricula_id: 'm3', limitacoes: 'Sala pequena', proximo_passo: 'Trabalhar o vínculo terapêutico', status_revisao: 'PENDENTE_REVISAO' }),
  reg('r4', 't1', '2026-09-01', { matricula_id: 'm4', duvidas_supervisao: 'Resistência antiga fora da janela' }),   // fora dos 14 dias
  reg('r5', 'outra', '2026-10-10', { matricula_id: 'm5', duvidas_supervisao: 'Resistência de outra turma' }),               // outra turma
];
const unidades = ['m1', 'm2', 'm3', 'm4'].map((id, i) => ({ unidadeId: id, tipo: 'INDIVIDUAL' as const, nome: `Estudante ${i + 1}` }));
const s = gerarSugestoesRss({
  turmaId: 't1', registros, unidades, hojeIso: '2026-10-13', temaLeitura: 'Aliança terapêutica e vínculo na clínica',
  nomeDe: r => `Estudante ${['m1', 'm2', 'm3', 'm4'].indexOf((r as any).matricula_id) + 1}`,
});

assert.equal(s.totalRelatos, 3, 'só 14 dias e só a turma pedida');
assert.equal(s.de, '2026-09-29');
assert.deepEqual(s.prioritarios.map(p => p.unidade), ['Estudante 1'], '"Não" não é prioridade; "Sim: risco…" é');
assert.equal(s.duvidas.length, 2);
assert.equal(s.limitacoes.length, 1);
assert.equal(s.limitacoes[0].emRevisao, true, 'em revisão fica sinalizado, mas acessível');
assert.deepEqual(s.unidadesSemRelato, ['Estudante 4'], 'quem não relatou na janela');
const termo = (t: string) => s.termos.find(x => x.termo.normalize('NFD').replace(/[̀-ͯ]/g, '') === t);
assert.equal(termo('resistencia')?.unidades, 2, 'termo recorrente contado por unidade');
assert.equal(termo('vinculo')?.unidades, 2, '"vínculo" em dúvida e em próximo passo, unidades diferentes');
assert.ok(!s.termos.some(t => ['paciente', 'sessao', 'como'].includes(t.termo)), 'palavras genéricas fora');
assert.ok(s.ligacaoComLeitura?.termos.some(t => /v[ií]nculo/.test(t)), 'liga a leitura do dia ao que apareceu nos relatos');
assert.ok(s.sugestoes.some(x => x.startsWith('Abrir pelos relatos marcados como prioridade')));
assert.ok(s.sugestoes.some(x => x.includes('Perguntar sobre 1 unidade sem RSS')));

// Sem RSS na janela: nenhuma sugestão inventada além do aviso de ausência.
const vazio = gerarSugestoesRss({ turmaId: 't1', registros: [], unidades, nomeDe: () => '', hojeIso: '2026-10-13' });
assert.equal(vazio.totalRelatos, 0);
assert.deepEqual(vazio.termos, []);
assert.equal(vazio.sugestoes.length, 1);

// Resumo de quem não enviou nos últimos 7 dias (por turma, sem aviso individual).
{
  const mk = (id: string, data: string, extra: Record<string, unknown>) =>
    ({ registro_id: id, turma_id: 't1', data_entrega: data, status: 'RECEBIDO', ...extra }) as any;
  const alunos = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'].map((id, i) => ({ unidadeId: id, tipo: 'INDIVIDUAL' as const, nome: `Aluno ${i + 1}` }));
  const regs = [
    mk('a', '2026-10-12', { matricula_id: 'm1' }),                                   // enviou
    mk('b', '2026-10-06', { matricula_id: 'm2' }),                                   // 7 dias atrás: dentro da janela
    mk('c', '2026-10-05', { matricula_id: 'm3' }),                                   // 8 dias atrás: fora
    mk('d', '2026-10-10', { matricula_id: 'm4', status_revisao: 'PENDENTE_REVISAO' }), // em revisão conta como enviado
    { ...mk('e', '2026-10-11', { matricula_id: 'm5' }), turma_id: 'outra' },         // outra turma não conta
  ];
  const r = resumirSemEnvioRss({ turmaId: 't1', registros: regs, unidades: alunos, hojeIso: '2026-10-13', praticaAtiva: true })!;
  assert.equal(r.semEnvio, 4, 'm3, m5, m6 e m7 não enviaram na janela');
  assert.equal(r.texto, '4 alunos não enviaram o registro nos últimos 7 dias.');
  assert.deepEqual(r.nomes, ['Aluno 3', 'Aluno 5', 'Aluno 6', 'Aluno 7']);
  assert.equal(r.totalUnidades, 7);

  const grupos = [{ unidadeId: 'g1', tipo: 'GRUPO' as const, nome: 'Grupo A' }, { unidadeId: 'g2', tipo: 'GRUPO' as const, nome: 'Grupo B' }, { unidadeId: 'g3', tipo: 'GRUPO' as const, nome: 'Grupo C' }];
  const g = resumirSemEnvioRss({ turmaId: 't1', registros: [mk('x', '2026-10-12', { grupo_id: 'g1', matricula_id: 'm9' })], unidades: grupos, hojeIso: '2026-10-13', praticaAtiva: true })!;
  assert.equal(g.texto, '2 grupos não enviaram o registro nos últimos 7 dias.', 'grupo é uma unidade; autora do grupo não vira aluno');
  const um = resumirSemEnvioRss({ turmaId: 't1', registros: [], unidades: [grupos[0]], hojeIso: '2026-10-13', praticaAtiva: true })!;
  assert.equal(um.texto, '1 grupo não enviou o registro nos últimos 7 dias.', 'singular');
  const todos = resumirSemEnvioRss({ turmaId: 't1', registros: [mk('y', '2026-10-13', { matricula_id: 'm1' })], unidades: [alunos[0]], hojeIso: '2026-10-13', praticaAtiva: true })!;
  assert.equal(todos.semEnvio, 0);
  assert.equal(todos.texto, 'Todos os alunos enviaram o registro nos últimos 7 dias.');
  assert.equal(resumirSemEnvioRss({ turmaId: 't1', registros: [], unidades: alunos, hojeIso: '2026-08-01', praticaAtiva: false }), null, 'prática não iniciada: sem resumo');
  assert.equal(resumirSemEnvioRss({ turmaId: 't1', registros: [], unidades: [], hojeIso: '2026-10-13', praticaAtiva: true }), null, 'sem unidades: sem resumo');
}
console.log('Preparar aula: sugestões a partir do RSS dos últimos 14 dias validadas.');
