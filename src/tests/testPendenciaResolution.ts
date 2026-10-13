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
console.log('Pendências: resolução por período e id estável validada.');
