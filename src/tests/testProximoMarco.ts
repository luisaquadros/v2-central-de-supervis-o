import assert from 'node:assert/strict';
import { proximoMarcoDaTurma } from '../services/supervisaoOperacionalService';

const m = (marco_id: string, nome: string, data_prazo: string, status: string, turma_id = '') => ({ marco_id, nome, data_prazo, status, turma_id }) as any;
const marcos = [
  m('a', 'Início do semestre', '2026-08-01', 'CONCLUIDO'),                 // passado e concluído
  m('b', 'Fim do semestre', '2026-12-20', 'PENDENTE'),                     // geral, mais distante
  m('c', 'Início da semana de prática', '2026-08-31', 'CONCLUIDO', 't1'),  // passado
  m('d', 'Fim da semana de prática', '2026-11-21', 'PENDENTE', 't1'),      // da turma t1
  m('e', 'Fim da semana de prática', '2026-11-21', 'PENDENTE', 't2'),      // idêntico, outra turma
  m('f', 'Entrega do relatório final', '2026-11-10', 'PENDENTE', 't2'),    // só da t2, mais cedo
  m('g', 'Prazo sem data', '', 'PENDENTE', 't1'),
];
const t1 = proximoMarcoDaTurma(marcos, 't1', '2026-10-13')!;
assert.equal(t1.nome, 'Fim da semana de prática', 'não escolhe "Início do semestre" (passado/concluído)');
assert.equal(t1.data, '2026-11-21');
assert.equal(t1.diasRestantes, 39);
assert.equal(t1.geral, false);
const t2 = proximoMarcoDaTurma(marcos, 't2', '2026-10-13')!;
assert.equal(t2.nome, 'Entrega do relatório final', 'cada turma vê o seu próprio próximo marco');
assert.equal(t2.diasRestantes, 28);
assert.equal(proximoMarcoDaTurma(marcos, 't9', '2026-10-13')!.nome, 'Fim do semestre', 'turma sem marco próprio vê o geral');
assert.equal(proximoMarcoDaTurma(marcos, 't1', '2026-12-21'), null, 'depois de tudo: nenhum');
assert.equal(proximoMarcoDaTurma(marcos, 't1', '2026-11-21')!.diasRestantes, 0, 'no próprio dia conta como hoje');
assert.equal(proximoMarcoDaTurma([], 't1', '2026-10-13'), null);
console.log('Marcos: próximo marco por turma validado (sem passados, concluídos ou sem data).');
