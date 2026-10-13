/**
 * Testes do RSS da Clínica Ampliada: uma resposta validada é compartilhada
 * por todos os integrantes do mesmo grupo, sem criar pendências individuais.
 * Dados totalmente fictícios; não lê nem altera a planilha real.
 */
import { strict as assert } from 'node:assert';
import { gerarPendenciasCanonicas, obterSituacaoRssEstudante, obterSemanaRssValidada } from '../services/supervisaoOperacionalService';
import { normalizarDataAcademica, normalizarLinhasDaAba } from '../services/googleSheetsService';

const matA = {matricula_id:'m-a',aluno_id:'a',turma_id:'t-grupo',periodo_id:'2026-2',status:'MATRICULADO'};
const matB = {matricula_id:'m-b',aluno_id:'b',turma_id:'t-grupo',periodo_id:'2026-2',status:'MATRICULADO'};
const matC = {matricula_id:'m-c',aluno_id:'c',turma_id:'t-grupo',periodo_id:'2026-2',status:'MATRICULADO'};
const turma = {turma_id:'t-grupo',periodo_id:'2026-2',disciplina_id:'d-grupo',nome:'Clínica Ampliada',turno:'MATUTINO',status:'ATIVO'};
const group = {grupo_id:'g-1',turma_id:'t-grupo',nome_grupo:'Grupo teste',status:'ATIVO'};
const members = [matA,matB,matC].map(m=>({grupo_id:'g-1',matricula_id:m.matricula_id}));
const students=[{aluno_id:'a',nome:'Aluna A'},{aluno_id:'b',nome:'Aluna B'},{aluno_id:'c',nome:'Aluna C'}];
const docs = [
  {registro_id:'g-week-5',grupo_id:'g-1',turma_id:'t-grupo',matricula_id:'m-a',semana_rss:'5',status:'RECEBIDO',status_revisao:'VALIDADO',data_entrega:'2026-10-05'},
  {registro_id:'g-week-5-dup',grupo_id:'g-1',turma_id:'t-grupo',matricula_id:'m-a',semana_rss:'5',status:'RECEBIDO',status_revisao:'VALIDADO',data_entrega:'2026-10-06'},
  {registro_id:'g-week-6-review',grupo_id:'g-1',turma_id:'t-grupo',matricula_id:'m-c',semana_rss:'6',status:'RECEBIDO',status_revisao:'PENDENTE_REVISAO',data_entrega:'2026-10-11'},
  {registro_id:'g-encounter-3',grupo_id:'g-1',turma_id:'t-grupo',matricula_id:'m-b',encontro_numero:'3',semana_rss:'',status:'RECEBIDO',status_revisao:'PENDENTE_REVISAO',data_entrega:'2026-10-12'},
] as any[];
const status = {turma_id:'t-grupo',unidade_id:'g-1',unidade_tipo:'GRUPO',rss_esperados_ate_hoje:2,rss_recebidos_validos:1,saldo_rss:-1,status_rss:'ATRASADO'};

assert.equal(obterSemanaRssValidada(docs[0]),5);
assert.equal(obterSemanaRssValidada(docs[2]),null,'registro aguardando revisão não pode virar entrega válida');
assert.equal(obterSemanaRssValidada(docs[3]),null,'número do encontro clínico não é a semana do RSS');

for(const m of [matA,matB,matC]){
  const sit=obterSituacaoRssEstudante(m.matricula_id,'t-grupo',docs as any,status as any,undefined,undefined,undefined,'g-1');
  assert.equal(sit.registrosRealizados,1,'todos integrantes herdam apenas uma semana validada');
  assert.equal(sit.registrosEstudante.length,4,'todos integrantes veem os RSS do grupo');
  assert.equal(sit.saldoRss,-1,'pendência é coletiva do grupo, não do autor');
}
function pendencias(esperados:number, revisao = false){
  const dados = revisao ? docs : docs.filter(r => r.registro_id !== 'g-week-6-review');
  const cal = [
    {turma_id:'t-grupo', sequencia:5, semana_inicio:'2026-09-28', semana_fim:'2026-10-04'},
    {turma_id:'t-grupo', sequencia:6, semana_inicio:'2026-10-05', semana_fim:'2026-10-11'},
  ];
  return gerarPendenciasCanonicas('2026-2',[turma] as any,[matA,matB,matC] as any,students as any,[],[],dados as any,[],[],[],[],[],
    [{turma_id:'t-grupo',total_previsto:12}] as any,[],cal as any,
    [{...status,rss_esperados_ate_hoje:esperados,status_rss:esperados===1?'EM_DIA':'ATRASADO'}] as any,
    new Date(esperados===1 ? '2026-10-06T12:00:00' : '2026-10-13T12:00:00'),[group] as any,members as any
  ).filter(p=>p.tipo==='RSS_ATRASADO');
}
const missing=pendencias(2);
assert.equal(missing.length,1,'deve existir apenas uma pendência para o grupo');
assert.equal(missing[0].id,'pend-rss-grupo-g-1');
assert(missing[0].titulo.includes('Grupo teste'));
assert(!missing[0].titulo.includes('Aluna'));
assert.equal(pendencias(1).length,0,'grupo em dia não pode gerar qualquer pendência para os integrantes');
assert.equal(pendencias(2,true).length,0,'semana em revisão não é falta confirmada nem alerta punitivo');

assert.equal(normalizarDataAcademica('12/10/2026'),'2026-10-12');
assert.equal(normalizarDataAcademica('46307,64637'),'2026-10-12');
const rows=normalizarLinhasDaAba('registros_semanais',[
  {grupo_id:'g-1',matricula_id:'m-a',encontro_numero:'3',semana_rss:'5',data_entrega:'46307,64637'},
  {grupo_id:'g-1',matricula_id:'m-b',encontro_numero:'3',semana_rss:'',data_entrega:'12/10/2026'}
]);
assert.equal(rows[0].semana,'5');
assert.equal(rows[0].data_entrega,'2026-10-12');
assert.equal(rows[1].semana,'','encontro clínico sem semana RSS não deve ser contado');
const calendario=normalizarLinhasDaAba('calendario_rss',[{semana_inicio:'05/10/2026',semana_fim:'11/10/2026'}]);
assert.equal(calendario[0].semana_inicio,'2026-10-05');
assert.equal(calendario[0].semana_fim,'2026-10-11');
console.log('[PASS] RSS da Clínica Ampliada: grupo, semana, duplicidade, revisão, pendência única e datas.');
