import { strict as assert } from 'node:assert';
import { normalizarLinhasDaAba } from '../services/googleSheetsService';

const criterios = normalizarLinhasDaAba('criterios_avaliacao', [
  {criterio_id:'AD-PROVA',turma_id:'t-a',nome:'Prova',nota_maxima:'2',ativo:'TRUE'},
  {criterio_id:'AD-P1',turma_id:'t-a',nome:'Parte 1',nota_maxima:'1',ativo:'TRUE'},
  {criterio_id:'AD-DOC',turma_id:'t-a',nome:'Documentos',nota_maxima:'2,5',ativo:'TRUE'},
  {criterio_id:'AD-ASSID',turma_id:'t-a',nome:'Assiduidade',nota_maxima:'0,2',ativo:'FALSE'},
]);
assert.equal(criterios[2].nota_maxima,2.5);
assert.equal(criterios[3].ativo,false);
const notas = normalizarLinhasDaAba('avaliacoes', [
  {avaliacao_id:'1',matricula_id:'mat1',criterio_id:'AD-PROVA',nota:'1,8'},
  {avaliacao_id:'2',matricula_id:'mat1',criterio_id:'AD-P1',nota:'0'},
  {avaliacao_id:'3',matricula_id:'mat1',criterio_id:'AD-DOC',nota:''},
]);
assert.equal(notas[0].nota,1.8);
assert.equal(notas[1].nota,0,'nota zero deve continuar sendo nota válida');
assert.equal(notas[2].nota,null,'campo em branco não é nota zero');
const lancadas=notas.filter(n=>n.nota!==null && n.nota!==undefined);
assert.equal(lancadas.length,2);
assert(Math.abs(lancadas.reduce((a,n)=>a+n.nota,0)-1.8)<1e-8);
const completo=normalizarLinhasDaAba('avaliacoes_completas',[
 {avaliacao_id:'av1',nota_final:'1,8',nota_maxima:'10',notas_criterios_json:'[{"criterio_id":"AD-PROVA","nota":1.8}]',comentario_geral:'Parecer técnico'}
]);
assert.equal(completo[0].nota_final,1.8);
assert.equal(completo[0].notas_criterios.length,1);
assert.equal(completo[0].comentario_geral,'Parecer técnico');
console.log('[PASS] Avaliações: decimais, zero explícito, notas pendentes e pareceres.');
