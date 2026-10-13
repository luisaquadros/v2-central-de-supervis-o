import assert from 'node:assert/strict';
import { listarProximasSupervisoes, identificarProximaSupervisao, identificarSupervisaoAtual } from '../services/supervisaoOperacionalService';
import type { Turma, HorarioTurma, EncontroTurma, Matricula } from '../types';

const turmas = [
 {turma_id:'mat',nome:'Clínica Ampliada Matutino',status:'ATIVO',periodo_id:'p',disciplina_id:'d',turno:'MATUTINO'},
 {turma_id:'ad',nome:'Clínica Adulto Estágio 1',status:'ATIVO',periodo_id:'p',disciplina_id:'d',turno:'MATUTINO'},
 {turma_id:'not',nome:'Clínica Ampliada Noturno',status:'ATIVO',periodo_id:'p',disciplina_id:'d',turno:'NOTURNO'},
] as Turma[];
const horarios = [
 {horario_id:'hmat',turma_id:'mat',dia_semana:1,hora_inicio:'08:20',hora_fim:'11:00',data_inicio:'10/08/2026',data_fim:'30/11/2026',ativo:true},
 {horario_id:'had',turma_id:'ad',dia_semana:2,hora_inicio:'08:20',hora_fim:'11:00',data_inicio:'11/08/2026',data_fim:'01/12/2026',ativo:true},
 {horario_id:'hnot',turma_id:'not',dia_semana:2,hora_inicio:'18:30',hora_fim:'21:10',data_inicio:'11/08/2026',data_fim:'01/12/2026',ativo:true},
] as HorarioTurma[];
const encontros = [
 {encontro_id:'feriado',turma_id:'mat',data:'2026-10-12',status:'NAO_REALIZADO',motivo_nao_realizado:'Feriado'},
] as EncontroTurma[];
const referencia = new Date(2026,9,13,5,0,0);
const agenda=listarProximasSupervisoes(turmas,horarios,encontros,referencia,6);
assert.deepEqual(agenda.filter(a=>a.dataProxima==='2026-10-13').map(a=>a.turma.turma_id),['ad','not']);
assert.equal(identificarProximaSupervisao(turmas,horarios,encontros,referencia)?.turma.turma_id,'ad');
assert.equal(agenda.some(a=>a.dataProxima==='2026-10-12'),false);
assert.equal(agenda.some(a=>a.turma.turma_id==='mat'&&a.dataProxima==='2026-10-19'),true);
const depoisDaManha=new Date(2026,9,13,12,0);
assert.equal(identificarProximaSupervisao(turmas,horarios,encontros,depoisDaManha)?.turma.turma_id,'not');
// Um cancelamento atribuído erroneamente ao dia de hoje em outra turma não pode ocultar aulas reais.
const errado=[...encontros,{encontro_id:'erro',turma_id:'mat',data:'2026-10-13',status:'NAO_REALIZADO'} as EncontroTurma];
assert.equal(identificarSupervisaoAtual(turmas,horarios,[],errado,[] as Matricula[],new Date(2026,9,13,8,30)).turma?.turma_id,'ad');
assert.equal(identificarProximaSupervisao(turmas,horarios,errado,referencia)?.turma.turma_id,'ad');
console.log('Hoje: datas br, feriado, duas aulas, ordem cronológica e atualização passaram.');
