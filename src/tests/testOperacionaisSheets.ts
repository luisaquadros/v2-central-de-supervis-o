import assert from 'node:assert/strict';
import { chaveItemOperacional, prepararRegistroOperacional, combinarOperacionais,
  contarLegadosLocais, registrosOperacionais } from '../services/operacionaisSheetsService';
import type { Configuracao } from '../types';

const local=[{id:'cx1',texto_original:'Item local',status:'PENDENTE'},{id:'cx2',texto_original:'Item antigo',status:'PENDENTE'}];
const novo=prepararRegistroOperacional('CAIXA_ENTRADA',{id:'cx1',texto_original:'Atualizado remotamente',status:'CONFIRMADO'},'2026.2');
assert.equal(novo.chave,'APP_OPERACIONAL_V1:CAIXA_ENTRADA:cx1');
assert.equal(JSON.parse(novo.valor).registro.status,'CONFIRMADO');
const configs:Configuracao[]=[novo];
assert.equal(combinarOperacionais(local,configs,'CAIXA_ENTRADA').length,2);
assert.equal(combinarOperacionais(local,configs,'CAIXA_ENTRADA')[0].texto_original,'Atualizado remotamente');
assert.equal(contarLegadosLocais(local,configs,'CAIXA_ENTRADA'),1);
const apagado=prepararRegistroOperacional('CAIXA_ENTRADA',local[0],'2026.2',novo,true);
assert.deepEqual(combinarOperacionais(local,[apagado],'CAIXA_ENTRADA').map(x=>x.id),['cx2'],'Tombstone impede ressurreição do cache');
assert.equal(contarLegadosLocais(local,[apagado],'CAIXA_ENTRADA'),1);
const outra=prepararRegistroOperacional('FILA_PROFESSORA',{id:'fp1',titulo:'Revisar documentos'},'2026.2');
assert.equal(combinarOperacionais([],[outra],'FILA_PROFESSORA').length,1);
assert.equal(combinarOperacionais([],[outra],'FILA_SUPERVISAO').length,0);
assert.equal(registrosOperacionais([outra], 'FILA_PROFESSORA').get('fp1')?.excluido,false);
assert.throws(()=>chaveItemOperacional('FILA_PROFESSORA','../invalido'));
assert.equal(combinarOperacionais(local,[{...novo,valor:'{invalido'}],'CAIXA_ENTRADA').length,2);
console.log('Filas: IDs, leitura remota, cache, tombstones e legado protegidos.');
