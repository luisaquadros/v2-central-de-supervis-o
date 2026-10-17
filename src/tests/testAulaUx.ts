import { strict as assert } from 'node:assert';
import { obterLeiturasAgendadas, obterLacunasRssDaAula, derivarNotificacoesOperacionais } from '../services/supervisaoOperacionalService';
import { normalizarLinhasDaAba } from '../services/googleSheetsService';
import { SEIS_HORAS_MS, lerSessaoAutorizada, registrarSessaoAutorizada, encerrarSessaoAutorizada } from '../services/sessionPolicy';

// Leituras agendadas na aula cancelada transferem para a próxima supervisão.
// A leitura já prevista para a nova data é preservada, sem duplicação.
const leituras:any[]=[
 { leitura_id:'l1',turma_id:'A',data:'2026-10-06',tipo:'ESTUDO_DIRIGIDO',tema:'Discussão clínica',responsavel_nome:'Estudante A' },
 { leitura_id:'l2',turma_id:'A',data:'2026-10-13',tipo:'ESTUDO_DIRIGIDO',tema:'Discussão ética',responsavel_nome:'Estudante B' },
 { leitura_id:'l3',turma_id:'B',data:'2026-10-06',tipo:'ESTUDO_DIRIGIDO',tema:'Leitura B',responsavel_nome:'Estudante C' },
 { leitura_id:'l4',turma_id:'A',data:'2026-10-06',tipo:'LEITURA_RECOMENDADA',tema:'Apoio clínico' },
];
const encontros:any[]=[{turma_id:'A',data:'2026-10-06',status:'NAO_REALIZADO'}];
const agendadas=obterLeiturasAgendadas(leituras, encontros);
assert.equal(agendadas.find(l=>l.leitura_id==='l1')?.data_apresentacao,'2026-10-13');
assert.equal(agendadas.find(l=>l.leitura_id==='l1')?.responsavel_nome,'Estudante A');
assert.equal(agendadas.filter(l=>l.turma_id==='A' && l.data_apresentacao==='2026-10-13').length,2);
assert.equal(agendadas.find(l=>l.leitura_id==='l3')?.data_apresentacao,'2026-10-06');
assert.equal(agendadas.find(l=>l.leitura_id==='l4')?.reprogramada,false);
assert.equal(obterLeiturasAgendadas(leituras,[...encontros,{turma_id:'A',data:'2026-10-13',status:'NAO_REALIZADO'}] as any)
  .find(l=>l.leitura_id==='l1')?.data_apresentacao,'2026-10-20');
const original=normalizarLinhasDaAba('leituras_responsaveis',[
 {leitura_agenda_id:'la-1',data_discussao:'13/10/2026',titulo:'Texto técnico',responsaveis_texto:'Responsável 1',tipo:'ESTUDO_DIRIGIDO'}
]);
assert.equal(original[0].leitura_id,'la-1');
assert.equal(original[0].data,'2026-10-13');
assert.equal(original[0].responsavel_nome,'Responsável 1');

const calendario:any[]=[
 {turma_id:'T',sequencia:1,semana_fim:'2026-09-06'},
 {turma_id:'T',sequencia:2,semana_fim:'2026-09-13'},
 {turma_id:'T',sequencia:3,semana_fim:'2026-09-20'},
];
const situacao:any={turmaId:'T',registrosEstudante:[
 {semana_rss:'1',status:'RECEBIDO',status_revisao:'VALIDADO'},
 {semana_rss:'3',status:'RECEBIDO',status_revisao:'VALIDADO'}
]};
assert.deepEqual(obterLacunasRssDaAula(situacao,calendario,'2026-09-27'),{faltantes:[2],emRevisao:[]});
const emRevisao:any={...situacao,registrosEstudante:[...situacao.registrosEstudante,{semana_rss:'2',status:'RECEBIDO',status_revisao:'PENDENTE_REVISAO'}]};
// Sem etapa de validação: o registro antes "em revisão" é uma entrega; não há mais lista de revisão.
assert.deepEqual(obterLacunasRssDaAula(emRevisao,calendario,'2026-09-27'),{faltantes:[],emRevisao:[]});
const notificacoes=derivarNotificacoesOperacionais([],[],[],[],[{registro_id:'x',semana:2,status:'FALTANTE'}] as any,[],[],[],[],new Date('2026-10-13T12:00:00'));
assert(notificacoes.every(n=>!String(n.tipo).toUpperCase().includes('RSS')));

const store=new Map<string,string>();
(globalThis as any).localStorage={
 getItem:(k:string)=>store.get(k)??null,
 setItem:(k:string,v:string)=>store.set(k,v),
 removeItem:(k:string)=>store.delete(k),
};
const now=1_800_000_000_000;
registrarSessaoAutorizada('conta-a',now);
assert.equal(lerSessaoAutorizada('conta-a',now+SEIS_HORAS_MS-1),true);
assert.equal(lerSessaoAutorizada('conta-a',now+SEIS_HORAS_MS),false);
assert.equal(lerSessaoAutorizada('conta-b',now+1000),false);
encerrarSessaoAutorizada();
assert.equal(lerSessaoAutorizada('conta-a',now+1000),false);
import { listarDatasSupervisao } from '../services/historicoAulas';
const datas= listarDatasSupervisao('T',[
 {turma_id:'T',ativo:true,dia_semana:2,data_inicio:'2026-09-01',data_fim:'2026-10-20'},
 {turma_id:'U',ativo:true,dia_semana:3,data_inicio:'2026-09-01',data_fim:'2026-10-20'}
] as any,[
 {turma_id:'T',data:'2026-10-06',status:'NAO_REALIZADO'},
 {turma_id:'T',data:'2026-10-08',status:'REALIZADO'}
] as any,'2026-09-01','2026-12-01','2026-10-17');
assert(datas.some(d=>d.data==='2026-10-06'&&d.situacao==='Não realizada'));
assert(datas.some(d=>d.data==='2026-10-08'&&d.situacao==='Registrada'));
assert(datas.every(d=>d.data<='2026-10-17'));
assert(!datas.some(d=>d.data==='2026-10-07'));
console.log('[PASS] Interface operacional: 6h de sessão, transferência de leituras, RSS, histórico temporal e alertas.');
