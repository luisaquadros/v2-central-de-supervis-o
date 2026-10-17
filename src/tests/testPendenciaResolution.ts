import assert from 'node:assert/strict';
import { filtrarPendenciasResolvidas } from '../services/pendenciaResolutionService';
import type { Configuracao, ItemPendenciaOperacional } from '../types';
const entries = [
 {id:'pend-chamada-t1-2026-10-13',tipo:'CHAMADA'},
 {id:'pend-rss-m1',tipo:'RSS_ATRASADO'},
 {id:'pend-doc-d1',tipo:'DOCUMENTO'},
] as ItemPendenciaOperacional[];
const conf = [
 {configuracao_id:'c1',chave:'PENDENCIA_RESOLVIDA:pend-chamada-t1-2026-10-13',valor:'{}',periodo_id:'2026.2'},
 {configuracao_id:'c2',chave:'PENDENCIA_RESOLVIDA:pend-rss-m1',valor:'{}',periodo_id:'2025.2'},
] as Configuracao[];
assert.deepEqual(filtrarPendenciasResolvidas(entries, conf, '2026.2').map(x=>x.id),['pend-rss-m1','pend-doc-d1']);
assert.equal(filtrarPendenciasResolvidas(entries, conf, '2025.2').length,2);
assert.equal(filtrarPendenciasResolvidas(entries, [], '2026.2').length,3);
import { chaveCobranca, lerCobranca, novoEventoCobranca, ultimaCobranca } from '../services/cobrancasDocumentais';
const chaveDoc=chaveCobranca('m-1','TERMO_COMPROMISSO');
const primeiro=novoEventoCobranca({data_contato:'',canal:'EMAIL',situacao:'CONTATO_ENVIADO',nota:'Aviso enviado, data exata desconhecida'},'evt-1','2026-10-17T14:00:00Z');
const segundo=novoEventoCobranca({data_contato:'2026-10-19',canal:'EMAIL',situacao:'RECEBIDO_A_CONFERIR',nota:'Anexo recebido'},'evt-2','2026-10-19T10:00:00Z');
const cfg:Configuracao={configuracao_id:'co1',chave:chaveDoc,periodo_id:'2026.2',valor:JSON.stringify({versao:1,eventos:[primeiro,segundo]})};
assert.equal(lerCobranca([cfg],'2026.2','m-1','TERMO_COMPROMISSO').eventos.length,2);
assert.equal(ultimaCobranca(lerCobranca([cfg],'2026.2','m-1','TERMO_COMPROMISSO').eventos)?.situacao,'RECEBIDO_A_CONFERIR');
assert.equal(lerCobranca([cfg],'2025.2','m-1','TERMO_COMPROMISSO').eventos.length,0);
assert.equal(lerCobranca([cfg],'2026.2','m-2','TERMO_COMPROMISSO').eventos.length,0);
assert.equal(filtrarPendenciasResolvidas(entries,[...conf,cfg],'2026.2').length,2,'cobrança não resolve pendência acadêmica');
assert.throws(()=>novoEventoCobranca({data_contato:'ontem',canal:'EMAIL',situacao:'CONTATO_ENVIADO',nota:''},'evt-x','2026-10-17T14:00:00Z'),/Data inválida/);
console.log('Pendências: resolução independente do histórico de cobrança e ausência de datas presumidas validadas.');
