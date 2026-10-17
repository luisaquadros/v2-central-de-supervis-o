import assert from 'node:assert/strict';
import { resumirDocumentosDaTurma, frasesDeDocumentosFaltando, quadroDeDocumentos } from '../services/documentacaoAcademicaService';
import type { Entrega } from '../types';

const e = (id: string, m: string, tipo: string, status: string): Entrega =>
  ({ entrega_id: id, matricula_id: m, tipo_documento: tipo, status_entrega: status } as unknown as Entrega);
const entregas = [
  e('1', 'M1', 'MANUAL_ESTAGIO', 'Pendente'), e('2', 'M2', 'MANUAL_ESTAGIO', 'Entregue'), e('3', 'M3', 'MANUAL_ESTAGIO', 'A conferir'),
  e('4', 'M1', 'TERMO_COMPROMISSO', 'Pendente'), e('5', 'M2', 'TERMO_COMPROMISSO', 'Pendente'), e('6', 'M3', 'TERMO_COMPROMISSO', 'Não se aplica'),
  e('7', 'OUTRA', 'MANUAL_ESTAGIO', 'Pendente'),
];
const r = resumirDocumentosDaTurma(entregas, new Set(['M1', 'M2', 'M3']));
assert.deepEqual(r.map(x => x.tipo), ['TERMO_COMPROMISSO', 'MANUAL_ESTAGIO']);
assert.equal(r[0].naoEntregaram, 2); assert.equal(r[0].naoSeAplica, 1);
assert.equal(r[1].naoEntregaram, 1); assert.equal(r[1].aConferir, 1); assert.equal(r[1].entregues, 1);
assert.deepEqual(frasesDeDocumentosFaltando(r), ['2 alunos não entregaram: Termo de Compromisso', '1 aluno não entregou: Manual do Estágio']);

const q = quadroDeDocumentos(entregas, ['M1', 'M2', 'M4']);
assert.equal(q.tipos.length, 2);
assert.equal(q.linhas[1].celulas[1].marcado, true);   // M2 manual entregue
assert.equal(q.linhas[0].celulas[1].marcado, false);  // M1 manual pendente
assert.equal(q.linhas[2].celulas[0].situacao, 'SEM_REGISTRO'); // M4 sem linha
console.log('testDocumentosTurma OK');
