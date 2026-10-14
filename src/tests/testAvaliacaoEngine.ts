import { strict as assert } from 'node:assert';
import {
  calcularCriterio, calcularAvaliacao, auditarAvaliacao, formatarPontos, classificarOcorrencias,
  type EntradaCriterio, type PeriodoAvaliacao,
} from '../services/avaliacaoEngine';
import { entradasDaMatricula, ocorrenciasParaAvaliacao } from '../services/avaliacaoAdaptador';

const perto = (a: number | null, b: number, eps = 1e-9) => assert(a !== null && Math.abs(a - b) < eps, `${a} != ${b}`);
const base = { disciplinaId: 'd1' };
const periodo: PeriodoAvaliacao = { rotulo: 'Prazo', progressRatio: 0.5, esperadosRegistros: 5, totalRegistros: 12 };

const prova = (nota: number | null): EntradaCriterio => ({ ...base, id: 'prova', nome: 'Prova', tipo: 'single', maxPontos: 2,
  config: { regra: 'nota_escalada', escalaBruta: 10 }, dados: { nota } });
// Prova
perto(calcularCriterio(prova(10)).score, 2);
perto(calcularCriterio(prova(8.5)).score, 1.7);
perto(calcularCriterio(prova(7)).score, 1.4);
assert.equal(calcularCriterio(prova(null)).score, null, 'sem nota = null, nunca zero');
assert.equal(calcularCriterio(prova(null)).status, 'nao_avaliado');
perto(calcularCriterio(prova(0)).score, 0); // zero explícito é nota válida

// Relatório parcial (penalidade configurável)
const rel = (entrega: any, latePenalty?: number): EntradaCriterio => ({ ...base, id: 'rel', nome: 'Relatório parcial', tipo: 'single',
  maxPontos: 1, config: { regra: 'entrega_prazo', ...(latePenalty !== undefined ? { latePenalty } : {}) }, dados: { entrega } });
perto(calcularCriterio(rel('no_prazo')).score, 1);
perto(calcularCriterio(rel('antecipado')).score, 1);
const tarde = calcularCriterio(rel('apos_prazo'));
perto(tarde.score, 0.9);
assert.equal(tarde.deducoes.length, 1, 'penalidade vira dedução auditável');
assert.equal(tarde.deducoes[0].automatica, true);
perto(calcularCriterio(rel('apos_prazo', 0.25)).score, 0.75); // configurável, não hardcoded
assert.equal(calcularCriterio(rel('desconhecido')).score, null);
assert.equal(calcularCriterio(rel('desconhecido')).status, 'a_conferir');

// RSS: denominador = total do semestre, nunca o esperado até o prazo
const rss = (n: number | null): EntradaCriterio => ({ ...base, id: 'rss', nome: 'Registros', tipo: 'proportional', maxPontos: 0.5,
  config: { totalEsperado: 12 }, dados: { concluidos: n, esperadosAteOPrazo: 5 } });
perto(calcularCriterio(rss(0)).score, 0);
perto(calcularCriterio(rss(1)).score, 0.5 / 12);
perto(calcularCriterio(rss(4)).score, 4 / 12 * 0.5);
perto(calcularCriterio(rss(5)).score, 5 / 12 * 0.5);
perto(calcularCriterio(rss(12)).score, 0.5);
assert.equal(formatarPontos(calcularCriterio(rss(4)).score), '0,17');
assert.equal(calcularCriterio(rss(4)).situacao, '4 de 5 até o prazo · 12 no semestre');
assert.equal(calcularCriterio(rss(null)).score, null);

// Contínuo
const cont = (max: number, modo: any = 'progress'): EntradaCriterio => ({ ...base, id: 'c' + max, nome: 'Contínuo', tipo: 'continuous',
  maxPontos: max, config: { calculationMode: modo } });
perto(calcularCriterio(cont(2.5), periodo).score, 1.25);
perto(calcularCriterio(cont(0.8), periodo).score, 0.4);
perto(calcularCriterio(cont(1), periodo).score, 0.5);
perto(calcularCriterio(cont(0.2), periodo).score, 0.1);
assert.equal(calcularCriterio(cont(1, 'manual'), periodo).score, null, 'modo manual não sobrescreve por progresso');

// Rubrica: sem fórmula explícita, não inventa; preserva lançamento manual
const subs = [
  { id: 's1', criterioId: 'r', nome: 'A', maxPontos: 1, peso: 0.4, nota: 0.5 },
  { id: 's2', criterioId: 'r', nome: 'B', maxPontos: 1, peso: 0.6, nota: 1 },
];
const rub = (agregacao?: any, nota?: number): EntradaCriterio => ({ ...base, id: 'r', nome: 'Rubrica', tipo: 'rubric', maxPontos: 2,
  subcriterios: subs, config: agregacao ? { agregacao } : undefined, dados: nota !== undefined ? { nota } : {} });
perto(calcularCriterio(rub('soma')).score, 1.5);
perto(calcularCriterio(rub('media_ponderada')).score, 0.5 * 0.4 + 1 * 0.6);
perto(calcularCriterio(rub('normalizacao')).score, (1.5 / 2) * 2);
assert.equal(calcularCriterio(rub()).score, null);
assert.equal(calcularCriterio(rub()).status, 'aguardando_decisao', 'sem fórmula definida: não inventa');
perto(calcularCriterio(rub(undefined, 1.2)).score, 1.2);
assert.equal(calcularCriterio(rub()).subcriterios.length, 2, 'subcritérios preservados');

// Híbrido só compõe se declarado
const hib: EntradaCriterio = { ...base, id: 'h', nome: 'Híbrido', tipo: 'hybrid', maxPontos: 2, subcriterios: subs,
  config: { hibrido: 'min_base_rubrica', agregacao: 'soma' } };
perto(calcularCriterio(hib, periodo).score, 1); // min(2*0.5, 1.5)
assert.equal(calcularCriterio({ ...hib, config: undefined }, periodo).status, 'aguardando_decisao');

// Fora do limite não entra no acumulado
assert.equal(calcularCriterio({ ...prova(10), config: { regra: 'nota_escalada' } }).status, 'a_conferir');

// Ocorrências: sem regra cadastrada, nunca descontam
const oc = classificarOcorrencias([
  { id: 'o1', tipo: 'USO_INADEQUADO_DISPOSITIVO', deducaoAutomatica: false, status: 'registrada' },
  { id: 'o2', tipo: 'X', deducaoAutomatica: true, valorDeducao: 0.1, criterioId: 'prova', regraId: 'R1', origem: 'regra', justificativa: 'j', status: 'registrada' },
  { id: 'o3', tipo: 'Y', deducaoAutomatica: true, valorDeducao: 0.1, status: 'registrada' }, // sem regra/origem
]);
assert.equal(oc.aplicaveis.length, 1);
assert.equal(oc.pendentes.length, 2);

// Caso real da ficha (anonimizado): reproduz 4,29 sem média nem projeção
const doc = (id: string, max: number): EntradaCriterio => ({ ...base, id, nome: id, tipo: 'continuous', maxPontos: max, config: { calculationMode: 'progress' } });
const ficha: EntradaCriterio[] = [
  prova(5), rel('no_prazo'),
  { ...base, id: 'final', nome: 'Relatório final', tipo: 'manual', maxPontos: 2, dados: { naoAvaliado: true } },
  doc('doc', 2.5), rss(1), doc('part', 0.8), doc('desemp', 1), doc('assid', 0.2),
];
const res = calcularAvaliacao(ficha, { periodo });
assert.equal(formatarPontos(res.totalAcumulado), '4,29');
assert.equal(res.totalMaximo, 10);
assert.equal(res.criterios.find(c => c.id === 'final')!.status, 'nao_avaliado');
assert.deepEqual(auditarAvaliacao(ficha, res), []);
assert(!('media' in res) && !('previsao' in res));

// "A conferir" e "não avaliado" não entram no acumulado
const r2 = calcularAvaliacao([prova(10), rel('desconhecido')], { periodo });
perto(r2.totalAcumulado, 2);

// Auditoria detecta subcritério perdido
const r3 = calcularAvaliacao([rub('soma')]);
r3.criterios[0].subcriterios = [];
assert(auditarAvaliacao([rub('soma')], r3).some(p => p.codigo === 'SUBCRITERIO_PERDIDO'));

// Regressão: estrutura atual (8 critérios planos, nota null preservada, ordem, inativos)
const criteriosPlanilha: any[] = [
  { criterio_id: 'P', turma_id: 't', nome: 'Prova', nota_maxima: 2, ordem: 1, ativo: true },
  { criterio_id: 'D', turma_id: 't', nome: 'Documentação', nota_maxima: 2.5, ordem: 2, ativo: true },
  { criterio_id: 'X', turma_id: 't', nome: 'Inativo', nota_maxima: 1, ordem: 3, ativo: false },
  { criterio_id: 'O', turma_id: 'outra', nome: 'Outra turma', nota_maxima: 1, ordem: 4, ativo: true },
];
const notasPlanilha: any[] = [{ avaliacao_id: '1', matricula_id: 'm1', criterio_id: 'P', nota: 1.8, observacao: 'ok' }];
const ent = entradasDaMatricula(criteriosPlanilha, notasPlanilha, 'm1', 't');
assert.equal(ent.length, 2);
assert.equal(ent[0].tipo, 'manual', 'sem configuração, usa a nota já lançada');
const rAtual = calcularAvaliacao(ent);
perto(rAtual.criterios[0].score, 1.8);
assert.equal(rAtual.criterios[1].score, null, 'sem nota continua null');
perto(rAtual.totalAcumulado, 1.8);
const comSub = entradasDaMatricula([{ ...criteriosPlanilha[0], tipo_calculo: 'rubric',
  subcriterios_json: JSON.stringify(subs), config_calculo_json: JSON.stringify({ agregacao: 'soma' }) }], [], 'm1', 't');
assert.equal(comSub[0].subcriterios!.length, 2);
perto(calcularAvaliacao(comSub).totalAcumulado, 1.5);
const ocsAdapt = ocorrenciasParaAvaliacao([{ ocorrencia_id: 'o', matricula_id: 'm1', data_hora: '', tipo: 'ATRASO', observacao: '' }], 'm1');
assert.equal(ocsAdapt[0].deducaoAutomatica, false);
assert.equal(calcularAvaliacao(ent, { ocorrencias: ocsAdapt }).ocorrenciasPendentes.length, 1);
perto(calcularAvaliacao(ent, { ocorrencias: ocsAdapt }).totalAcumulado, 1.8);

console.log('[PASS] Engine de avaliação: prova, relatório, RSS, contínuo, rubrica, híbrido, ocorrências, auditoria e regressão.');
