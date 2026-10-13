import assert from 'node:assert/strict';
import { interpretarFrequenciaOficial, statusFrequenciaParaPlanilha, interpretarStatusEntrega } from '../services/normalizacaoAcademica';
import { normalizarLinhasDaAba } from '../services/googleSheetsService';

assert.deepEqual(interpretarFrequenciaOficial('ATRASO'), {status:'PRESENTE', atraso:true,statusOriginal:'ATRASO'});
assert.equal(interpretarFrequenciaOficial('PRESENTE').atraso,false);
assert.equal(interpretarFrequenciaOficial('FALTA_JUSTIFICADA').status,'FALTA_JUSTIFICADA');
assert.equal(interpretarFrequenciaOficial('desconhecido').status,'NAO_IDENTIFICADO');
assert.equal(statusFrequenciaParaPlanilha('PRESENTE',true),'ATRASO');
assert.equal(statusFrequenciaParaPlanilha('PRESENTE',false),'PRESENTE');
assert.equal(statusFrequenciaParaPlanilha('FALTA_SEM_JUSTIFICATIVA',true),'FALTA_SEM_JUSTIFICATIVA');
const antigos = normalizarLinhasDaAba('frequencias',[
  {frequencia_id:'f1',matricula_id:'m1',data_aula:'13/10/2026',status:'ATRASO'},
  {frequencia_id:'f2',matricula_id:'m2',data_aula:'13/10/2026',status:'PRESENTE'}
]);
assert.equal(antigos[0].status,'PRESENTE');
assert.equal(antigos[0].atraso,true);
assert.equal(antigos[0].data_aula,'2026-10-13');
assert.equal(antigos[1].atraso,false);
for (const [raw,expected] of [
 ['Enviado','ENVIADO'],['Entregue','ENTREGUE'],['A conferir','A_CONFERIR'],
 ['Pendente','PENDENTE'],['Não se aplica','NAO_SE_APLICA'],['','DESCONHECIDO']
]) assert.equal(interpretarStatusEntrega(raw),expected);
console.log('Normalização: frequência de atraso e status acadêmicos preservados.');
