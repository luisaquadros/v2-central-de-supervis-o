import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resumirNotasMatricula, somarNotasValidas } from '../services/avaliacaoResumo';

// Fórmula LEGADA da AlunoFichaView (referência de regressão): soma de notas válidas de critérios ativos da disciplina.
function somaLegada(criterios: any[], notas: any[], disciplinaId: string): number {
  const ativos = criterios.filter(c => c.disciplina_id === disciplinaId && c.ativo);
  return notas
    .filter(a => a.nota !== null && a.nota !== undefined && String(a.nota).trim() !== '')
    .reduce((acc, av) => {
      if (!ativos.some(c => c.criterio_id === av.criterio_id)) return acc;
      const n = Number(String(av.nota).replace(',', '.'));
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
}

// Dados válidos (cenários de várias turmas): a soma nova é IDÊNTICA à legada.
const criterios: any[] = [];
const notas: any[] = [];
for (const turma of ['t1', 't2', 't3']) {
  [2, 1, 2, 2.5, 0.5, 0.8, 1, 0.2].forEach((max, i) => {
    criterios.push({ criterio_id: `${turma}-${i}`, turma_id: turma, disciplina_id: `d-${turma}`, nome: `C${i}`, nota_maxima: max, ordem: i, ativo: true });
    if (i % 3 !== 2) notas.push({ avaliacao_id: `${turma}-${i}`, matricula_id: `m-${turma}`, criterio_id: `${turma}-${i}`, nota: max * (0.5 + (i % 2) * 0.25) });
  });
}
for (const turma of ['t1', 't2', 't3']) {
  const doAluno = notas.filter(n => n.matricula_id === `m-${turma}`);
  const novo = resumirNotasMatricula({ criterios, avaliacoes: doAluno, matriculaId: null, turmaId: turma, disciplinaId: `d-${turma}` });
  assert(Math.abs(novo.totalOficial - somaLegada(criterios, doAluno, `d-${turma}`)) < 1e-9, `soma divergente em ${turma}`);
}

// Divergência intencional e documentada: nota inválida deixa de virar 0 silencioso (fica sinalizada e fora da soma)
const comInvalida: any[] = [{ avaliacao_id: 'x', matricula_id: 'm-t1', criterio_id: 't1-0', nota: 'abc' }, { avaliacao_id: 'y', matricula_id: 'm-t1', criterio_id: 't1-1', nota: 0.5 }];
const ri = resumirNotasMatricula({ criterios, avaliacoes: comInvalida, matriculaId: null, turmaId: 't1', disciplinaId: 'd-t1' });
assert.deepEqual(ri.invalidos, ['t1-0']);
assert.equal(ri.totalOficial, 0.5);
assert.equal(ri.lancados, 1);

// Nota ausente permanece null (não é lançamento)
const semNota = resumirNotasMatricula({ criterios, avaliacoes: [{ avaliacao_id: 'z', matricula_id: 'm', criterio_id: 't1-0', nota: null } as any], matriculaId: null, turmaId: 't1', disciplinaId: 'd-t1' });
assert.equal(semNota.lancados, 0);
assert.equal(semNota.resultado.criterios[0].oficial, null);

// Zero explícito é nota lançada
const zero = resumirNotasMatricula({ criterios, avaliacoes: [{ avaliacao_id: 'z', matricula_id: 'm', criterio_id: 't1-0', nota: 0 } as any], matriculaId: null, turmaId: 't1', disciplinaId: 'd-t1' });
assert.equal(zero.lancados, 1);

assert.deepEqual(somarNotasValidas([1, '2,5', null, '', 'x', undefined]), { total: 3.5, invalidos: 1 });

// As duas telas usam o serviço compartilhado e não somam notas por conta própria
const ficha = readFileSync('src/views/AlunoFichaView.tsx', 'utf8');
const aval = readFileSync('src/views/AvaliacaoView.tsx', 'utf8');
assert(ficha.includes('resumirNotasMatricula') && ficha.includes('selecionarCriteriosAplicaveis'));
assert(aval.includes('somarNotasValidas') && aval.includes('selecionarCriteriosAplicaveis'));
assert(!/\(Number\(val\) \|\| 0\)/.test(aval), 'AvaliacaoView não pode converter inválido em 0');
assert(!/isNaN\(n\) \? 0 : n/.test(ficha), 'AlunoFichaView não pode converter inválido em 0');
console.log('[PASS] Unificação: AvaliacaoView e AlunoFichaView usam o mesmo cálculo; soma idêntica à legada; inválido sinalizado.');
