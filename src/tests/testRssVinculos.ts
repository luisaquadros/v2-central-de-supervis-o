import assert from 'node:assert/strict';
import { selecionarRssDoEstudante } from '../services/rssVinculos';
import { obterSemanaRssValidada, obterSituacaoRssEstudante } from '../services/supervisaoOperacionalService';
import { normalizarLinhasDaAba } from '../services/googleSheetsService';
import { CAMPOS_TEXTO_RSS } from '../components/LeituraRss';
import type { Matricula,Aluno,RegistroSemanal,GrupoPratica,GrupoIntegrante } from '../types';

const matriculas=[
 {matricula_id:'m1',aluno_id:'a1',turma_id:'t1'},
 {matricula_id:'m2',aluno_id:'a2',turma_id:'t1'},
 {matricula_id:'m3',aluno_id:'a3',turma_id:'t2'},
 {matricula_id:'m4',aluno_id:'a4',turma_id:'tg'},
 {matricula_id:'m5',aluno_id:'a5',turma_id:'tg'},
 {matricula_id:'m6',aluno_id:'a6',turma_id:'tg'},
] as Matricula[];
const alunos=matriculas.map((m,i)=>({aluno_id:m.aluno_id,nome:'Pessoa '+(i+1),identificador_academico:String(i+1)})) as Aluno[];
const grupos=[{grupo_id:'g1',turma_id:'tg'},{grupo_id:'g2',turma_id:'tg'}] as GrupoPratica[];
const integrantes=[
 {grupo_id:'g1',matricula_id:'m4',status:'ATIVO'},
 {grupo_id:'g1',matricula_id:'m5',status:'ATIVO'},
 {grupo_id:'g2',matricula_id:'m6',status:'ATIVO'},
] as GrupoIntegrante[];
const registros=[
 {registro_id:'r1',turma_id:'t1',matricula_id:'m1',semana_rss:'1',encontro_numero:'7',status:'RECEBIDO',status_revisao:'VALIDADO',objetivos:'Objetivo de teste'},
 {registro_id:'r2',turma_id:'t1',matricula_id:'m2',semana_rss:'2',status:'RECEBIDO',status_revisao:'VALIDADO'},
 {registro_id:'r3',turma_id:'t2',matricula_id:'m3',semana_rss:'3',status:'RECEBIDO',status_revisao:'VALIDADO'},
 {registro_id:'r4',turma_id:'tg',grupo_id:'g1',matricula_id:'m4',semana_rss:'4',status:'RECEBIDO',status_revisao:'VALIDADO'},
 {registro_id:'r5',turma_id:'tg',grupo_id:'g2',matricula_id:'m6',semana_rss:'5',status:'RECEBIDO',status_revisao:'VALIDADO'},
 {registro_id:'r6',turma_id:'tg',grupo_id:'g1',matricula_id:'m5',semana_rss:'',encontro_numero:'6',status:'RECEBIDO',status_revisao:'PENDENTE_REVISAO'},
 {registro_id:'r7',turma_id:'t2',matricula_id:'m1',semana_rss:'2',status:'RECEBIDO',status_revisao:'VALIDADO'},
] as unknown as RegistroSemanal[];
const obter=(m:string,t:string,igs=integrantes)=>selecionarRssDoEstudante({matriculaId:m,turmaId:t,registros,matriculas,alunos,grupos,integrantes:igs});
assert.deepEqual(obter('m1','t1').registros.map(r=>r.registro_id),['r1'],'RSS de outra turma não entra');
assert.deepEqual(obter('m2','t1').registros.map(r=>r.registro_id),['r2'],'RSS individual não passa a colega');
assert.deepEqual(obter('m4','tg').registros.map(r=>r.registro_id),['r4','r6'],'grupo vê ambos RSS, inclusive em revisão');
assert.deepEqual(obter('m5','tg').registros.map(r=>r.registro_id),['r4','r6']);
assert.deepEqual(obter('m6','tg').registros.map(r=>r.registro_id),['r5'],'outro grupo permanece separado');
assert.equal(obter('m6','t1').modo,'SEM_MATRICULA');
assert.equal(obter('m4','tg',[...integrantes,{grupo_id:'g2',matricula_id:'m4',status:'ATIVO'}]).modo,'GRUPO_AMBIGUO');
assert.equal(obter('m4','tg',[...integrantes,{grupo_id:'g2',matricula_id:'m4',status:'INATIVO'}]).modo,'GRUPO');
assert.equal(obterSemanaRssValidada(registros[0]),1);
assert.equal(obterSemanaRssValidada(registros[5]),null,'número clínico não é semana RSS');
const sit=obterSituacaoRssEstudante('m5','tg',obter('m5','tg').registros,undefined,undefined,undefined,undefined,'g1');
// Sem etapa de validação: r6 (sem semana, só número do encontro) é uma entrega contada no total, mas NÃO vira semana.
assert.equal(sit.registrosRealizados,2,'entrega sem semana identificada conta no total');
assert.deepEqual(sit.entregas!.semanasEntregues,[4],'só a semana comprovada entra na lista de semanas');
assert.deepEqual(sit.entregas!.semSemanaIdentificada,['r6']);
const normalizados=normalizarLinhasDaAba('registros_semanais',[{semana_rss:'',encontro_numero:'8',limitacoes:'Falta de sala',objetivos:'Avaliar'}]);
assert.equal(normalizados[0].semana,'');
assert.equal(normalizados[0].observacao,'');
assert.equal(normalizados[0].limitacoes,'Falta de sala');
for(const k of ['objetivos','tecnicas_atividades','manejo_resposta','compreensao_atual','proximo_passo','prioridade_supervisao','duvidas_supervisao','limitacoes']){
 assert(CAMPOS_TEXTO_RSS.some(([key])=>key===k),'Campo de conteúdo ausente: '+k);
}
console.log('RSS: cinco eixos de validação passaram.');
