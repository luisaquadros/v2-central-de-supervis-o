import { strict as assert } from 'node:assert';
import { obterLeiturasAgendadas, classificarRssOperacional, calcularMetricasCronogramaRss } from '../services/supervisaoOperacionalService';
import { normalizarLinhasDaAba } from '../services/googleSheetsService';
import { lerSessaoAutorizada, registrarSessaoAutorizada, encerrarSessaoAutorizada, SEIS_HORAS_MS } from '../services/sessionPolicy';

const encontros = [
  { turma_id:'adultos',data:'2026-10-06',status:'NAO_REALIZADO' },
  { turma_id:'infantil',data:'2026-10-08',status:'NAO_REALIZADO' },
  { turma_id:'adultos',data:'2026-10-20',status:'NAO_REALIZADO' },
] as any[];
const leituras = [
  { leitura_id:'antiga',turma_id:'adultos',data:'2026-10-06',titulo:'Leitura anterior',responsavel_nome:'Pessoa A',tipo:'ESTUDO_DIRIGIDO' },
  { leitura_id:'corrente',turma_id:'adultos',data:'2026-10-13',titulo:'Leitura normal',responsavel_nome:'Pessoa B',tipo:'ESTUDO_DIRIGIDO' },
  { leitura_id:'segunda',turma_id:'adultos',data:'2026-10-20',titulo:'Outras responsáveis',tipo:'ESTUDO_DIRIGIDO' },
  { leitura_id:'inf',turma_id:'infantil',data:'2026-10-08',titulo:'Infantojuvenil',tipo:'ESTUDO_DIRIGIDO' },
  { leitura_id:'apoio',turma_id:'adultos',data:'2026-10-06',titulo:'Leitura de apoio',tipo:'LEITURA_RECOMENDADA' },
] as any[];
const agenda = obterLeiturasAgendadas(leituras,encontros);
assert.equal(agenda.find(l=>l.leitura_id==='antiga')?.data_apresentacao,'2026-10-13');
assert.equal(agenda.find(l=>l.leitura_id==='antiga')?.responsavel_nome,'Pessoa A');
assert.equal(agenda.filter(l=>l.data_apresentacao==='2026-10-13').length,2,'leituras acumulam, não são substituídas');
assert.equal(agenda.find(l=>l.leitura_id==='inf')?.data_apresentacao,'2026-10-15');
assert.equal(agenda.find(l=>l.leitura_id==='segunda')?.data_apresentacao,'2026-10-27','pula semana seguinte cancelada');
assert.equal(agenda.find(l=>l.leitura_id==='apoio')?.data_apresentacao,'2026-10-06','apoio não cria apresentação');

const tabs = normalizarLinhasDaAba('horarios_turma',[
  { dia_semana:'SEGUNDA',ativo:'TRUE',data_inicio:'10/08/2026',data_fim:'30/11/2026' },
  { dia_semana:'TERCA',ativo:'FALSE',data_inicio:'11/08/2026',data_fim:'01/12/2026' }
]);
assert.equal(tabs[0].dia_semana,1);
assert.equal(tabs[1].dia_semana,2);
assert.equal(tabs[0].ativo,true);
assert.equal(tabs[1].ativo,false);
assert.equal(tabs[0].data_inicio,'2026-08-10');

const semanas = Array.from({length:12},(_,i)=>({
  turma_id:'adultos',sequencia:i+1,
  semana_inicio:new Date(Date.UTC(2026,7,31+i*7)).toISOString().slice(0,10),
  semana_fim:new Date(Date.UTC(2026,8,6+i*7)).toISOString().slice(0,10),
}));
const indicador = calcularMetricasCronogramaRss('adultos',semanas as any,[{turma_id:'adultos',aula_cronograma_atual:10}] as any,'2026-10-13');
assert.equal(indicador.semanaAtual,7);
assert.equal(indicador.semanasEncerradas,6);
assert.equal(indicador.totalSemanas,12);

const situacao = {
  turmaId:'adultos',matriculaId:'pessoa',registrosEstudante:[{semana_rss:6,status:'RECEBIDO',status_revisao:'VALIDADO'}],
} as any;
const historico = classificarRssOperacional(situacao,semanas as any,'2026-10-13');
assert.equal(historico.categoria,'HISTORICO_INCOMPLETO','última semana entregue silencia histórico incompleto');
assert.equal(historico.faltamHistoricas,5);
const recente = classificarRssOperacional({...situacao,registrosEstudante:[]},semanas as any,'2026-10-13');
assert.equal(recente.categoria,'RECENTE_PENDENTE');

const box = new Map<string,string>();
(globalThis as any).localStorage = {
  getItem:(key:string)=>box.get(key)||null,
  setItem:(key:string,val:string)=>box.set(key,String(val)),
  removeItem:(key:string)=>box.delete(key)
};
encerrarSessaoAutorizada();
const now=Date.UTC(2026,9,13);
assert(!lerSessaoAutorizada('u',now));
registrarSessaoAutorizada('u',now);
assert(lerSessaoAutorizada('u',now+SEIS_HORAS_MS-1));
assert(!lerSessaoAutorizada('u',now+SEIS_HORAS_MS));
assert(!lerSessaoAutorizada('outro',now+1000));
encerrarSessaoAutorizada();
assert(!lerSessaoAutorizada('u',now+1000));
console.log('[PASS] UI: calendário, leituras adiadas, grupos de status, dias da semana e sessão 6h.');
