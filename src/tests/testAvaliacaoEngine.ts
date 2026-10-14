import { strict as assert } from 'node:assert';
import {
  calcularCriterio, calcularAvaliacao, auditarAvaliacao, formatarPontos, classificarOcorrencias, lerNumero,
  pontuarSubcriterio, type EntradaCriterio, type Subcriterio,
} from '../services/avaliacaoEngine';
import { entradasDaMatricula, ocorrenciasParaAvaliacao, selecionarCriteriosAplicaveis } from '../services/avaliacaoAdaptador';
import { resumirNotasMatricula } from '../services/avaliacaoResumo';

const perto = (a: number | null, b: number, eps = 1e-9) => assert(a !== null && Math.abs(a - b) < eps, `${a} != ${b}`);
const base = { disciplinaId: 'd1' };

// --- Leitura de valores: ausente ≠ zero ≠ inválido
assert.deepEqual(lerNumero(null), { valor: null, invalido: false });
assert.deepEqual(lerNumero(''), { valor: null, invalido: false });
assert.deepEqual(lerNumero('1,8'), { valor: 1.8, invalido: false });
assert.deepEqual(lerNumero(0), { valor: 0, invalido: false });
assert.equal(lerNumero('abc').invalido, true);
assert.equal(lerNumero(NaN).invalido, true);

// --- Proporcional (prova): prévia = bruto/10 × máx; a nota OFICIAL nunca é alterada
const prova = (bruto: unknown, oficial?: unknown): EntradaCriterio => ({ ...base, id: 'prova', nome: 'Prova', tipo: 'proportional',
  maxPontos: 2, config: { denominador: 10 }, dados: { valorBruto: bruto, nota: oficial } });
perto(calcularCriterio(prova(10)).previa, 2);
perto(calcularCriterio(prova(8.5)).previa, 1.7);
perto(calcularCriterio(prova(7)).previa, 1.4);
assert.equal(calcularCriterio(prova(null)).previa, null, 'sem nota bruta = null, nunca zero');
assert.equal(calcularCriterio(prova(null)).status, 'nao_avaliado');
perto(calcularCriterio(prova(0)).previa, 0); // zero explícito é nota válida
assert.equal(calcularCriterio(prova(11)).previa, null, 'acima da escala não vira prévia');
assert(calcularCriterio(prova('x')).alertas.length > 0);
// prévia sem oficial: considerada, mas rotulada como não oficial e fora do total oficial
const soPrevia = calcularAvaliacao([prova(7)]);
perto(soPrevia.totalOficial, 0); perto(soPrevia.totalComPrevias, 1.4);
assert.equal(soPrevia.criterios[0].origem, 'previa');
// oficial divergente: preservada, divergência sinalizada
const div = calcularAvaliacao([prova(7, 1.0)]);
perto(div.totalOficial, 1.0);
assert.equal(div.divergencias.length, 1);
perto(div.divergencias[0].diferenca, 0.4);
assert.equal(calcularAvaliacao([prova(7, 1.4)]).divergencias.length, 0);

// --- RSS (proporcional): denominador = total do semestre; nunca vira critério sozinho
const rss = (n: unknown): EntradaCriterio => ({ ...base, id: 'rss', nome: 'Registros', tipo: 'proportional', maxPontos: 0.5,
  config: { denominador: 12 }, dados: { valorBruto: n, esperadosAteOPrazo: 5 } });
perto(calcularCriterio(rss(0)).previa, 0);
perto(calcularCriterio(rss(1)).previa, 0.5 / 12);
perto(calcularCriterio(rss(4)).previa, 4 / 12 * 0.5);
perto(calcularCriterio(rss(5)).previa, 5 / 12 * 0.5);
perto(calcularCriterio(rss(12)).previa, 0.5);
assert.equal(formatarPontos(calcularCriterio(rss(4)).previa), '0,17');
assert.equal(calcularCriterio(rss(4)).situacao, '4 de 5 até o prazo · 12 no semestre');

// --- A: prazo ≠ qualidade. Entrega pontual NÃO gera nota; atraso só desconta com regra expressa
const rel = (entrega: any, oficial?: unknown, regraAtraso?: any, qualidade?: unknown): EntradaCriterio => ({ ...base, id: 'rel', nome: 'Relatório parcial',
  tipo: 'manual', maxPontos: 1, config: regraAtraso ? { regraAtraso } : undefined, dados: { entrega, nota: oficial } });
const pontual = calcularCriterio(rel('no_prazo'));
assert.equal(pontual.score, null, 'entrega pontual não gera nota máxima');
assert.equal(pontual.prazo, 'no_prazo');
assert.equal(calcularCriterio(rel('antecipado')).score, null);
const atrasoSemRegra = calcularCriterio(rel('apos_prazo', 0.9));
perto(atrasoSemRegra.score, 0.9); assert.equal(atrasoSemRegra.deducoes.length, 0, 'sem regra expressa não há desconto');
const regra = { regraId: 'R-ATRASO', valor: 0.1, justificativa: 'Regra expressa da turma' };
const relRubrica: EntradaCriterio = { ...base, id: 'rel2', nome: 'Relatório', tipo: 'rubric', maxPontos: 1,
  subcriterios: [{ id: 's', criterioId: 'rel2', nome: 'Qualidade', maxPontos: 1, nivel: 'EXCELENTE' }],
  config: { agregacao: 'soma', regraAtraso: regra }, dados: { entrega: 'apos_prazo' } };
const comRegra = calcularCriterio(relRubrica);
perto(comRegra.previa, 0.9); assert.equal(comRegra.deducoes[0].regraId, 'R-ATRASO');
perto(calcularCriterio({ ...relRubrica, dados: { entrega: 'no_prazo' } }).previa, 1);
perto(calcularCriterio({ ...relRubrica, config: { agregacao: 'soma' } }).previa, 1, 1e-9); // atraso sem regra: sem desconto
// oficial lançada não é reduzida por atraso
perto(calcularCriterio({ ...relRubrica, dados: { entrega: 'apos_prazo', nota: 1 } }).oficial, 1);

// --- B: participação/desempenho não vêm do tempo; sem rubrica aprovada, preserva a nota manual
const part: EntradaCriterio = { ...base, id: 'part', nome: 'Participação', tipo: 'continuous', maxPontos: 0.8, dados: {} };
assert.equal(calcularCriterio(part).score, null);
perto(calcularCriterio({ ...part, dados: { nota: 0.6 } }).oficial, 0.6);
perto(calcularCriterio({ ...part, dados: { nota: 0 } }).oficial, 0, 1e-12); // zero explícito vale

// --- Subcritérios e níveis
const nivelPct = (nivel: any): Subcriterio => ({ id: 'a', criterioId: 'r', nome: 'A', maxPontos: 0.65, nivel });
perto(pontuarSubcriterio(nivelPct('EXCELENTE')).valor, 0.65);
perto(pontuarSubcriterio(nivelPct('ADEQUADO')).valor, 0.65 * 0.75);
perto(pontuarSubcriterio(nivelPct('PARCIAL')).valor, 0.325);
perto(pontuarSubcriterio(nivelPct('INSUFICIENTE')).valor, 0.65 * 0.25);
perto(pontuarSubcriterio(nivelPct('NAO_ATENDIDO')).valor, 0);
assert.equal(pontuarSubcriterio(nivelPct('NAO_AVALIADO')).valor, null, 'não avaliado = null');
assert.equal(pontuarSubcriterio({ id: 'x', criterioId: 'r', nome: 'X', maxPontos: 1 }).valor, null);
// ajuste manual exige justificativa
assert.equal(pontuarSubcriterio({ ...nivelPct('PARCIAL'), ajuste: { nota: 0.6, justificativa: '' } }).valor, null);
perto(pontuarSubcriterio({ ...nivelPct('PARCIAL'), ajuste: { nota: 0.6, justificativa: 'Evidência no caso X' } }).valor, 0.6);
assert.equal(pontuarSubcriterio({ ...nivelPct('PARCIAL'), ajuste: { nota: 9, justificativa: 'j' } }).valor, null, 'ajuste acima do limite');

const subs: Subcriterio[] = [
  { id: 's1', criterioId: 'r', nome: 'A', maxPontos: 1, peso: 0.4, nota: 0.5 },
  { id: 's2', criterioId: 'r', nome: 'B', maxPontos: 1, peso: 0.6, nota: 1 },
];
const rub = (agregacao?: any, oficial?: unknown, sub = subs): EntradaCriterio => ({ ...base, id: 'r', nome: 'Rubrica', tipo: 'rubric', maxPontos: 2,
  subcriterios: sub, config: agregacao ? { agregacao } : undefined, dados: oficial !== undefined ? { nota: oficial } : {} });
perto(calcularCriterio(rub('soma')).previa, 1.5);
perto(calcularCriterio(rub('media_ponderada')).previa, 0.5 * 0.4 + 1 * 0.6);
perto(calcularCriterio(rub('normalizacao')).previa, (1.5 / 2) * 2);
assert.equal(calcularCriterio(rub()).previa, null, 'sem fórmula aprovada não calcula');
assert.equal(calcularCriterio(rub()).status, 'aguardando_decisao');
perto(calcularCriterio(rub(undefined, 1.2)).oficial, 1.2, 1e-12);
assert.equal(calcularCriterio(rub()).subcriterios.length, 2, 'subcritérios preservados');
// rubrica incompleta: sem prévia, parcial informativo e fora dos totais
const incompleta = calcularCriterio(rub('soma', undefined, [subs[0], { ...subs[1], nota: null }]));
assert.equal(incompleta.previa, null); perto(incompleta.previaParcial, 0.5);
perto(calcularAvaliacao([rub('soma', undefined, [subs[0], { ...subs[1], nota: null }])]).totalComPrevias, 0);
// rubrica completa não sobrescreve oficial divergente
const rubDiv = calcularAvaliacao([rub('soma', 1.0)]);
perto(rubDiv.totalOficial, 1.0); assert.equal(rubDiv.divergencias.length, 1);

// --- E: nota inválida/fora do limite é sinalizada, nunca zero nem somada
for (const ruim of ['abc', NaN, 3, -1]) {
  const r = calcularCriterio({ ...base, id: 'm', nome: 'M', tipo: 'manual', maxPontos: 2, dados: { nota: ruim } });
  assert.equal(r.invalida, true); assert.equal(r.status, 'a_conferir'); assert.equal(r.score, null); assert.equal(r.oficial, null);
}
const comRuim = calcularAvaliacao([
  { ...base, id: 'a', nome: 'A', tipo: 'manual', maxPontos: 2, dados: { nota: 'abc' } },
  { ...base, id: 'b', nome: 'B', tipo: 'manual', maxPontos: 1, dados: { nota: 0.5 } },
]);
perto(comRuim.totalOficial, 0.5); assert.deepEqual(comRuim.invalidas, ['a']);

// --- Ocorrências: sem regra nunca descontam; éticas geram sinalização separada; sem dupla penalização
const oc = classificarOcorrencias([
  { id: 'o1', tipo: 'USO_INADEQUADO_DISPOSITIVO', deducaoAutomatica: false, status: 'registrada' },
  { id: 'o2', tipo: 'X', deducaoAutomatica: true, valorDeducao: 0.1, criterioId: 'r', regraId: 'R1', origem: 'regra', justificativa: 'j', status: 'registrada' },
  { id: 'o3', tipo: 'Y', deducaoAutomatica: true, valorDeducao: 0.1, status: 'registrada' },
  { id: 'o4', tipo: 'ETICA', deducaoAutomatica: true, valorDeducao: 0.5, criterioId: 'r', regraId: 'R2', origem: 'x', justificativa: 'j', eticaRelevante: true, status: 'registrada' },
]);
assert.equal(oc.aplicaveis.length, 1);
assert.equal(oc.sinalizacoes.length, 1, 'ética gera sinalização');
assert(!oc.aplicaveis.some(d => d.regraId === 'R2'), 'ética relevante nunca desconta automaticamente');
const mesmoFato = calcularAvaliacao([
  { ...rub('soma'), id: 'c1', subcriterios: subs.map(s => ({ ...s, criterioId: 'c1' })) },
  { ...rub('soma'), id: 'c2', subcriterios: subs.map(s => ({ ...s, criterioId: 'c2' })) },
], { ocorrencias: [
  { id: 'oz', tipo: 'ATRASO', deducaoAutomatica: true, valorDeducao: 0.2, criterioId: 'c1', regraId: 'R', origem: 'regra', justificativa: 'j', status: 'registrada' },
] });
perto(mesmoFato.criterios[0].previa, 1.3); perto(mesmoFato.criterios[1].previa, 1.5);
const dupla = [
  { ...rub('soma'), id: 'c1', subcriterios: subs.map(s => ({ ...s, criterioId: 'c1' })),
    deducoes: [{ regraId: 'R', origem: 'o', origemId: 'fato-1', criterioId: 'c1', valor: 0.2, justificativa: 'j', automatica: true }] },
  { ...rub('soma'), id: 'c2', subcriterios: subs.map(s => ({ ...s, criterioId: 'c2' })),
    deducoes: [{ regraId: 'R', origem: 'o', origemId: 'fato-1', criterioId: 'c2', valor: 0.2, justificativa: 'j', automatica: true }] },
];
const rd = calcularAvaliacao(dupla);
perto(rd.criterios[0].previa, 1.3); perto(rd.criterios[1].previa, 1.5);

// --- Caso real da ficha (anonimizada): oficial soma 4,29, sem média/projeção
const m = (id: string, max: number, nota: number | null): EntradaCriterio => ({ ...base, id, nome: id, tipo: 'manual', maxPontos: max, dados: { nota } });
const ficha: EntradaCriterio[] = [
  m('prova', 2, 1.0), m('introducao', 1, 1.0), m('final', 2, null), m('doc', 2.5, 1.25),
  m('seminario', 0.5, 0.04166666666666667), m('part', 0.8, 0.4), m('desemp', 1, 0.5), m('assid', 0.2, 0.1),
];
const res = calcularAvaliacao(ficha);
assert.equal(formatarPontos(res.totalOficial), '4,29');
assert.equal(res.totalMaximo, 10);
assert.equal(res.criterios.find(c => c.id === 'final')!.status, 'nao_avaliado');
assert.deepEqual(auditarAvaliacao(ficha, res), []);
assert(!('media' in res) && !('previsao' in res) && !('projecao' in res));

// auditoria detecta subcritério perdido
const r3 = calcularAvaliacao([rub('soma')]);
r3.criterios[0].subcriterios = [];
assert(auditarAvaliacao([rub('soma')], r3).some(p => p.codigo === 'SUBCRITERIO_PERDIDO'));

// --- Diferenças entre turmas (pesos e nomes distintos; nada padronizado)
const criteriosPlanilha: any[] = [
  { criterio_id: 'A-P', turma_id: 'ta', disciplina_id: 'd', nome: 'Prova teórica', nota_maxima: 2, ordem: 1, ativo: true },
  { criterio_id: 'A-S', turma_id: 'ta', disciplina_id: 'd', nome: 'Seminário', nota_maxima: 0.5, ordem: 2, ativo: true },
  { criterio_id: 'B-P', turma_id: 'tb', disciplina_id: 'd', nome: 'Prova', nota_maxima: 3, ordem: 1, ativo: true },
  { criterio_id: 'B-X', turma_id: 'tb', disciplina_id: 'd', nome: 'Inativo', nota_maxima: 1, ordem: 2, ativo: false },
];
const notas: any[] = [
  { avaliacao_id: '1', matricula_id: 'm1', criterio_id: 'A-P', nota: 1.8, observacao: 'ok' },
  { avaliacao_id: '2', matricula_id: 'm2', criterio_id: 'B-P', nota: 2.5, observacao: '' },
];
assert.equal(selecionarCriteriosAplicaveis(criteriosPlanilha, { turmaId: 'ta', disciplinaId: 'd' }).length, 2);
assert.equal(selecionarCriteriosAplicaveis(criteriosPlanilha, { turmaId: 'tb', disciplinaId: 'd' }).length, 1, 'inativos fora');
const ra = resumirNotasMatricula({ criterios: criteriosPlanilha, avaliacoes: notas, matriculaId: 'm1', turmaId: 'ta', disciplinaId: 'd' });
const rb = resumirNotasMatricula({ criterios: criteriosPlanilha, avaliacoes: notas, matriculaId: 'm2', turmaId: 'tb', disciplinaId: 'd' });
perto(ra.totalOficial, 1.8); perto(ra.totalMaximo, 2.5); assert.equal(ra.lancados, 1);
perto(rb.totalOficial, 2.5); perto(rb.totalMaximo, 3);
assert.equal(ra.resultado.criterios[1].score, null, 'sem nota continua null');
assert.equal(entradasDaMatricula(criteriosPlanilha, notas, 'm1', 'ta')[0].tipo, 'manual', 'nome parecido não define fórmula');

// --- Configuração opcional por critério (rubrica com níveis aprovada)
const comSub = entradasDaMatricula([{ ...criteriosPlanilha[0], tipo_calculo: 'rubric',
  subcriterios_json: JSON.stringify(subs), config_calculo_json: JSON.stringify({ agregacao: 'soma' }) }], [], 'm1', 'ta');
assert.equal(comSub[0].subcriterios!.length, 2);
perto(calcularAvaliacao(comSub).totalComPrevias, 1.5);
perto(calcularAvaliacao(comSub).totalOficial, 0);

// --- Ocorrências existentes: pendentes, sem desconto
const ocsAdapt = ocorrenciasParaAvaliacao([{ ocorrencia_id: 'o', matricula_id: 'm1', data_hora: '', tipo: 'ATRASO', observacao: '' }], 'm1');
assert.equal(ocsAdapt[0].deducaoAutomatica, false);
const rOc = resumirNotasMatricula({ criterios: criteriosPlanilha, avaliacoes: notas, matriculaId: 'm1', turmaId: 'ta', disciplinaId: 'd',
  ocorrencias: [{ ocorrencia_id: 'o', matricula_id: 'm1', data_hora: '', tipo: 'ATRASO', observacao: '' } as any] });
assert.equal(rOc.resultado.ocorrenciasPendentes.length, 1);
perto(rOc.totalOficial, 1.8);

console.log('[PASS] Engine de avaliação: oficial×prévia, prazo×qualidade, níveis, rubrica, inválidos, ocorrências, turmas e ficha 4,29.');
