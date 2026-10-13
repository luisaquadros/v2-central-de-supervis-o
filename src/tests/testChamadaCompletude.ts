import assert from 'node:assert/strict';
import { chamadaCompletaNaData, identificarChamadasPendentes } from '../services/supervisaoOperacionalService';
import type { Matricula, Frequencia, Turma, HorarioTurma } from '../types';

const mats = [
  {matricula_id:'m1',aluno_id:'a1',turma_id:'t1',status:'MATRICULADO'},
  {matricula_id:'m2',aluno_id:'a2',turma_id:'t1',status:'ATIVO'},
  {matricula_id:'m3',aluno_id:'a3',turma_id:'t1',status:'INATIVO'},
  {matricula_id:'m4',aluno_id:'a4',turma_id:'t2',status:'MATRICULADO'},
] as Matricula[];
const parcial=[{frequencia_id:'f1',matricula_id:'m1',data_aula:'2026-10-13',status:'PRESENTE'}] as Frequencia[];
assert.equal(chamadaCompletaNaData('t1','2026-10-13',mats,parcial),false,'Uma presença não fecha turma com duas matrículas');
assert.equal(chamadaCompletaNaData('t2','2026-10-13',mats,parcial),false);
assert.equal(chamadaCompletaNaData('vazia','2026-10-13',mats,parcial),false);
const completa=[...parcial,{frequencia_id:'f2',matricula_id:'m2',data_aula:'2026-10-13',status:'FALTA_JUSTIFICADA'}] as Frequencia[];
assert.equal(chamadaCompletaNaData('t1','2026-10-13',mats,completa),true,'Falta registrada também conta como frequência lançada');
assert.equal(chamadaCompletaNaData('t1','2026-10-14',mats,completa),false,'Não misturar data');
const turmas=[{turma_id:'t1',nome:'Turma 1',status:'ATIVO'}] as Turma[];
const horarios=[{horario_id:'h1',turma_id:'t1',dia_semana:2,hora_inicio:'08:20',hora_fim:'11:00',data_inicio:'2026-08-01',data_fim:'2026-12-01',ativo:true}] as HorarioTurma[];
const pendParcial=identificarChamadasPendentes(turmas,horarios,parcial,[],mats,new Date(2026,9,14,12),2);
assert(pendParcial.some(x=>x.turma.turma_id==='t1' && x.dataAula==='2026-10-13'),'Chamada parcialmente salva deve continuar pendente');
const pendCompleta=identificarChamadasPendentes(turmas,horarios,completa,[],mats,new Date(2026,9,14,12),2);
assert(!pendCompleta.some(x=>x.turma.turma_id==='t1' && x.dataAula==='2026-10-13'));
console.log('Chamada: somente frequência completa de matrículas confirmadas encerra pendência.');
