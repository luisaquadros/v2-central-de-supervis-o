import assert from 'node:assert/strict';
import { listarAlunosChamada, diagnosticarChamada, separarResponsaveis, resolverResponsaveis } from '../services/aulaParticipants';
import type { Aluno, Matricula } from '../types';
const alunos=[{aluno_id:'a1',nome:'Ana',identificador_academico:'100',status:'ATIVO'},{aluno_id:'a2',nome:'Bruna',identificador_academico:'200',status:'ATIVO'},{aluno_id:'a3',nome:'Carla',identificador_academico:'300',status:'ATIVO'}] as Aluno[];
const matriculas=[
 {matricula_id:'m1',aluno_id:'a1',turma_id:'t1',status:''},
 {matricula_id:'m2',aluno_id:'a2',turma_id:'t1',status:' MATRICULADO '},
 {matricula_id:'m3',aluno_id:'a3',turma_id:'t1',status:'CANCELADO'},
] as Matricula[];
assert.deepEqual(listarAlunosChamada('t1',matriculas,alunos).map(x=>x.aluno.nome),['Bruna']);
assert.equal(diagnosticarChamada('t1',matriculas,alunos).matriculasElegiveis,1);
assert.equal(diagnosticarChamada('t1',matriculas,alunos).alunosLocalizados,1);
assert.deepEqual(
 listarAlunosChamada('t1',[{matricula_id:'m4',aluno_id:'100',turma_id:'t1',status:'MATRICULADO'} as Matricula],alunos).map(v=>v.aluno.nome),
 ['Ana']
);
assert.equal(diagnosticarChamada('t1',[{matricula_id:'m5',aluno_id:'inexistente',turma_id:'t1',status:'MATRICULADO'} as Matricula],alunos).alunosLocalizados,0);
assert.equal(listarAlunosChamada('t1',matriculas,alunos).some(v=>v.aluno.nome==='Ana'),false,'Matrícula sem situação confirmada não entra na chamada');
assert.deepEqual(separarResponsaveis('["m1","m2"]'),['m1','m2']);
assert.deepEqual(separarResponsaveis('Ana; Bruna'),['Ana','Bruna']);
const dados={matriculas,alunos,grupos:[],integrantes:[]};
assert.deepEqual(resolverResponsaveis({...dados,leitura:{responsaveis_previstos:'["m1","m2"]'}}).map(x=>x.nome),['Ana','Bruna']);
assert.deepEqual(resolverResponsaveis({...dados,leitura:{responsavel_nome:'Ana; Bruna'}}).map(x=>x.nome),['Ana','Bruna']);
assert.deepEqual(resolverResponsaveis({...dados,leitura:{responsavel_id:'m1',responsaveis_efetivos:'m2'}}).map(x=>x.nome),['Bruna','Ana'].sort((a,b)=>0)); // ordem prevista pela entrada
console.log('Participantes da aula: OK');
