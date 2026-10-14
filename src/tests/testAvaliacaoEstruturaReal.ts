/**
 * Estrutura REAL dos critérios (auditada na planilha de desenvolvimento): 6 turmas, 8 critérios cada, total 10,0.
 * Nomes variam entre turmas; `codigo_criterio` é estável. Sem dados pessoais: só critérios e notas sintéticas.
 */
import { strict as assert } from 'node:assert';
import { resumirNotasMatricula } from '../services/avaliacaoResumo';
import { sugerirClassificacaoCriterio } from '../services/rubricasAvaliacao';
import { formatarPontos } from '../services/avaliacaoEngine';
import { entradasDaMatricula } from '../services/avaliacaoAdaptador';

const PESOS: Array<[string, number]> = [['PROVA_TEORICA', 2], ['PARTE_1_RELATORIO', 1], ['RELATORIO_FINAL', 2], ['DOCUMENTACAO', 2.5], ['ATIVIDADE', 0.5],
  ['PARTICIPACAO_SUPERVISOES', 0.8], ['DESEMPENHO_TECNICO_PROFISSIONAL', 1], ['ASSIDUIDADE_PONTUALIDADE', 0.2]];
const TURMAS: Array<{ id: string; nome: string; doc: string; ativ: string; nomes: Record<string, string> }> = [
  { id: 'adulto', nome: 'Clínica Adulto — Estágio 1', doc: 'DOCUMENTACAO_CLINICA', ativ: 'SEMINARIO_EVIDENCIAS', nomes: { DOCUMENTACAO: 'Documentação Clínica', ATIVIDADE: 'Seminário Clínico Baseado em Evidências (Estudo Dirigido)', PARTE_1_RELATORIO: 'Parte 1 do Relatório' } },
  { id: 'infanto', nome: 'Infantojuvenil — Estágio 2', doc: 'DOCUMENTACAO_PRATICA', ativ: 'ATIVIDADE_AVALIATIVA', nomes: { DOCUMENTACAO: 'Documentação da prática', ATIVIDADE: 'Atividade avaliativa', PARTE_1_RELATORIO: 'Parte 1 do relatório' } },
  { id: 'ampl-m', nome: 'Clínica Ampliada — Matutino', doc: 'DOCUMENTACAO_PRATICA', ativ: 'ATIVIDADE_AVALIATIVA', nomes: { DOCUMENTACAO: 'Documentação da prática', ATIVIDADE: 'Seminário final', PARTE_1_RELATORIO: 'Parte 1 do relatório' } },
  { id: 'ampl-n', nome: 'Clínica Ampliada — Noturno', doc: 'DOCUMENTACAO_PRATICA', ativ: 'ATIVIDADE_AVALIATIVA', nomes: { DOCUMENTACAO: 'Documentação da prática', ATIVIDADE: 'Seminário final', PARTE_1_RELATORIO: 'Parte 1 do relatório' } },
  { id: 'saude', nome: 'Saúde Mental no Trabalho — Estágio 2', doc: 'DOCUMENTACAO_PRATICA', ativ: 'ATIVIDADE_AVALIATIVA', nomes: { DOCUMENTACAO: 'Documentação da prática', ATIVIDADE: 'Atividade avaliativa', PARTE_1_RELATORIO: 'Parte 1 do relatório' } },
  { id: 'consul', nome: 'Consultoria Organizacional — Estágio 3', doc: 'DOCUMENTACAO_PRATICA', ativ: 'ATIVIDADE_AVALIATIVA', nomes: { DOCUMENTACAO: 'Documentação da prática', ATIVIDADE: 'Atividade avaliativa', PARTE_1_RELATORIO: 'Parte 1 do relatório' } },
];
const criterios: any[] = [];
for (const t of TURMAS) PESOS.forEach(([cod, max], i) => criterios.push({
  criterio_id: `${t.id}-${cod}`, turma_id: t.id, disciplina_id: 'd-' + t.id, nome: t.nomes[cod] ?? cod.replaceAll('_', ' ').toLowerCase(), nota_maxima: max, peso: 1, ordem: i + 1, ativo: true,
  codigo_criterio: cod === 'DOCUMENTACAO' ? t.doc : cod === 'ATIVIDADE' ? t.ativ : cod }));

// cada turma: 8 critérios, total 10,0, sem critério de registros semanais
for (const t of TURMAS) {
  const r = resumirNotasMatricula({ criterios, avaliacoes: [], matriculaId: null, turmaId: t.id, disciplinaId: 'd-' + t.id });
  assert.equal(r.resultado.criterios.length, 8, t.nome);
  assert.equal(r.totalMaximo, 10, t.nome);
  assert(!r.resultado.criterios.some(c => /registros? semanais?/i.test(c.nome)), 'registros semanais não é critério');
  assert.equal(r.totalOficial, 0); assert.equal(r.lancados, 0, 'sem notas = nenhuma lançada (não zero)');
}
// nomes variam, o código é estável
const nomesAtiv = new Set(TURMAS.map(t => criterios.find(c => c.turma_id === t.id && c.criterio_id.endsWith('ATIVIDADE'))!.nome));
assert(nomesAtiv.size >= 3, 'nomes diferentes entre turmas são preservados');

// prova: nota oficial em pontos; valor_original guarda a nota bruta — a prévia proporcional confere com o oficial
const nota = (turma: string, cod: string, v: number, bruto?: string) => ({ avaliacao_id: `${turma}-${cod}`, matricula_id: 'm', criterio_id: `${turma}-${cod}`, nota: v, observacao: '', valor_original: bruto });
const configProva = (turma: string) => ({ [`${turma}-PROVA_TEORICA`]: { tipo: 'proportional' as const, config: { denominador: 10 } } });
for (const [bruto, pts] of [['5,0', 1.0], ['10,0', 2.0], ['9,0', 1.8], ['7,0', 1.4]] as const) {
  const r = resumirNotasMatricula({ criterios, avaliacoes: [nota('ampl-m', 'PROVA_TEORICA', pts, bruto)] as any, matriculaId: null, turmaId: 'ampl-m', disciplinaId: 'd-ampl-m', configPorCriterio: configProva('ampl-m') });
  const c = r.resultado.criterios[0];
  assert(Math.abs((c.previa ?? -1) - pts) < 1e-9 && c.oficial === pts, `${bruto} → ${pts}`);
  assert.equal(r.resultado.divergencias.length, 0);
}
// divergência: oficial 1,5 mas bruto 5,0 (=1,0): sinalizada, oficial preservada
const dv = resumirNotasMatricula({ criterios, avaliacoes: [nota('ampl-m', 'PROVA_TEORICA', 1.5, '5,0')] as any, matriculaId: null, turmaId: 'ampl-m', disciplinaId: 'd-ampl-m', configPorCriterio: configProva('ampl-m') });
assert.equal(dv.totalOficial, 1.5); assert.equal(dv.resultado.divergencias.length, 1);
// sem configuração, `valor_original` não vira prévia
assert.equal(resumirNotasMatricula({ criterios, avaliacoes: [nota('ampl-m', 'PROVA_TEORICA', 1.0, '5,0')] as any, matriculaId: null, turmaId: 'ampl-m', disciplinaId: 'd-ampl-m' }).resultado.criterios[0].previa, null);

// classificação sugerida pelo código estável (apenas sugestão)
const sug = (cod: string) => sugerirClassificacaoCriterio({ codigo_criterio: cod, nome: 'qualquer' })?.tipo;
assert.equal(sug('PROVA_TEORICA'), 'proportional'); assert.equal(sug('DOCUMENTACAO_CLINICA'), 'hybrid'); assert.equal(sug('DOCUMENTACAO_PRATICA'), 'hybrid');
assert.equal(sug('PARTICIPACAO_SUPERVISOES'), 'continuous'); assert.equal(sug('DESEMPENHO_TECNICO_PROFISSIONAL'), 'hybrid'); assert.equal(sug('ASSIDUIDADE_PONTUALIDADE'), 'hybrid');
assert.equal(sug('SEMINARIO_EVIDENCIAS'), 'rubric'); assert.equal(sug('ATIVIDADE_AVALIATIVA'), 'rubric'); assert.equal(sug('PARTE_1_RELATORIO'), 'rubric'); assert.equal(sug('RELATORIO_FINAL'), 'rubric');
assert.equal(entradasDaMatricula(criterios, [], 'm', 'adulto', {}, {}, 'd-adulto').every(e => e.tipo === 'manual'), true, 'a sugestão não é aplicada');
assert.equal(formatarPontos(10), '10,00');
console.log('[PASS] Estrutura real: 6 turmas × 8 critérios (10,0), nomes variáveis com código estável, prova proporcional confere, RSS fora dos critérios.');
