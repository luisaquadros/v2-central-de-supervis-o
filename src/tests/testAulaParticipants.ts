import assert from 'node:assert/strict';
import { listarAlunosChamada, separarResponsaveis, resolverResponsaveis } from '../services/aulaParticipants';
import type { Aluno, Matricula } from '../types';
const alunos=[{aluno_id:'a1',nome:'Ana',identificador_academico:'100',status:'ATIVO'},{aluno_id:'a2',nome:'Bruna',identificador_academico:'200',status:'ATIVO'},{aluno_id:'a3',nome:'Carla',identificador_academico:'300',status:'ATIVO'}] as Aluno[];
const matriculas=[
 {matricula_id:'m1',aluno_id:'a1',turma_id:'t1',status:''},
 {matricula_id:'m2',aluno_id:'a2',turma_id:'t1',status:' MATRICULADO '},
 {matricula_id:'m3',aluno_id:'a3',turma_id:'t1',status:'CANCELADO'},
] as Matricula[];
assert.deepEqual(listarAlunosChamada('t1',matriculas,alunos).map(x=>x.aluno.nome),['Ana','Bruna']);
assert.deepEqual(separarResponsaveis('["m1","m2"]'),['m1','m2']);
assert.deepEqual(separarResponsaveis('Ana; Bruna'),['Ana','Bruna']);
const dados={matriculas,alunos,grupos:[],integrantes:[]};
assert.deepEqual(resolverResponsaveis({...dados,leitura:{responsaveis_previstos:'["m1","m2"]'}}).map(x=>x.nome),['Ana','Bruna']);
assert.deepEqual(resolverResponsaveis({...dados,leitura:{responsavel_nome:'Ana; Bruna'}}).map(x=>x.nome),['Ana','Bruna']);
assert.deepEqual(resolverResponsaveis({...dados,leitura:{responsavel_id:'m1',responsaveis_efetivos:'m2'}}).map(x=>x.nome),['Bruna','Ana'].sort((a,b)=>0)); // ordem prevista pela entrada
console.log('Participantes da aula: OK');
