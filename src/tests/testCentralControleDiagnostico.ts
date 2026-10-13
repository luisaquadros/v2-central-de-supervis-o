import assert from 'node:assert/strict';
import { diagnosticarCentralControle } from '../services/centralControleDiagnostico';
import type { Turma, Matricula, Aluno } from '../types';
const h=['Turma','Aluno(a)','Período atual','E-mail','Grupo','Campo de prática','Manual do estágio','Termo de compromisso','Documentação externa'];
const rows:unknown[][]=[
 ['BASE DE ALUNOS'],[],['Automação','autorização','#REF!'],[],[],
 h,
 ['Clínica Ampliada — Matutino','Estudante fictício','','teste@example.org','','','Enviado','Entregue','A conferir'],
 ['Clínica Ampliada — Matutino','Estudante sem email','','','','','Enviado','Entregue','A conferir'],
];
const turmas=[{turma_id:'turma-ca-mat',nome:'Clínica Ampliada — Matutino'}] as Turma[];
const matriculas=[{matricula_id:'m1',aluno_id:'a1',turma_id:'turma-ca-mat'}] as Matricula[];
const alunos=[{aluno_id:'a1',nome:'Estudante fictício',email:'teste@example.org'}] as unknown as Aluno[];
const entregas=[
 {matricula_id:'m1',tipo_entrega:'MANUAL_ESTAGIO',status:'Enviado'},
 {matricula_id:'m1',tipo_entrega:'TERMO_COMPROMISSO',status:'Entregue'},
 {matricula_id:'m1',tipo_entrega:'DOCUMENTACAO_EXTERNA',status:'A conferir'},
];
const res=diagnosticarCentralControle(rows,turmas,matriculas,alunos,entregas);
assert.equal(res.lidos,2);
assert.equal(res.vinculados,1);
assert.equal(res.naoVinculados,1);
assert.equal(res.divergenciasDocumentais,0);
assert.equal(res.pendenteAutorizacaoRegistroSemanal,true);
assert.equal(res.autorizadoParaImportacao,false);
assert.throws(()=>diagnosticarCentralControle([...rows.slice(0,5),['cabeçalho errado'],...rows.slice(6)],turmas,matriculas,alunos,entregas),/Cabeçalho/);
console.log('Conector Central de Controle: comparação somente leitura validada.');
