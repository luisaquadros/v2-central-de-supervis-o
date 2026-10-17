import assert from 'node:assert/strict';
import { selecionarTresProximasAulas, resumirPendenciasPorTema } from '../services/painelInicialService';
import type { ResultadoProximaSupervisao } from '../services/supervisaoOperacionalService';
import type { ItemPendenciaOperacional } from '../types';

const entrada = [
  {dataProxima:'2026-10-27',horaInicio:'18:30',turma:{nome:'E'}},
  {dataProxima:'2026-10-20',horaInicio:'18:30',turma:{nome:'B'}},
  {dataProxima:'2026-10-21',horaInicio:'08:20',turma:{nome:'D'}},
  {dataProxima:'2026-10-20',horaInicio:'08:20',turma:{nome:'A'}},
  {dataProxima:'2026-10-20',horaInicio:'18:30',turma:{nome:'C'}},
] as ResultadoProximaSupervisao[];
assert.deepEqual(selecionarTresProximasAulas(entrada).map(x=>x.turma.nome),['A','B','C']);
assert.equal(selecionarTresProximasAulas(entrada).length,3);
assert.equal(selecionarTresProximasAulas(entrada.slice(0,2)).length,2);
assert.equal(selecionarTresProximasAulas([]).length,0);
assert.equal(entrada.length,5,'a agenda original nunca deve ser truncada');
const pendencias=[
  {id:'d1',tipo:'DOCUMENTO',turma_id:'t1'},
  {id:'d2',tipo:'DOCUMENTO',turma_id:'t1'},
  {id:'d3',tipo:'DOCUMENTO',turma_id:'t2'},
  {id:'a1',tipo:'CHAMADA',turma_id:'t3'},
  {id:'r1',tipo:'RSS_ATRASADO',turma_id:'t2'},
] as ItemPendenciaOperacional[];
const temas=resumirPendenciasPorTema(pendencias);
assert.equal(temas[0].chave,'CHAMADA');
assert.equal(temas.find(t=>t.chave==='DOCUMENTO')?.quantidade,3);
assert.equal(temas.find(t=>t.chave==='DOCUMENTO')?.descricao,'2 turma(s) envolvida(s)');
assert.equal(resumirPendenciasPorTema([]).length,0);
console.log('Início: limite de 3 aulas e agrupamento de pendências confirmados.');
