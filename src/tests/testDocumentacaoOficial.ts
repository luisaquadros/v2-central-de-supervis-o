import assert from 'node:assert/strict';
import { resumirDocumentacaoOficial, documentosPendentesOficiais } from '../services/documentacaoAcademicaService';
import type { Entrega, Documento } from '../types';

const entregas = [
  ...Array.from({length:80},(_,i)=>({entrega_id:'env'+i,matricula_id:'m1',tipo_entrega:'MANUAL_ESTAGIO',status:'Enviado'})),
  ...Array.from({length:35},(_,i)=>({entrega_id:'ent'+i,matricula_id:'m1',tipo_entrega:'TERMO_COMPROMISSO',status:'Entregue'})),
  ...Array.from({length:128},(_,i)=>({entrega_id:'con'+i,matricula_id:'m2',tipo_entrega:'DOCUMENTACAO_EXTERNA',status:'A conferir'})),
  ...Array.from({length:6},(_,i)=>({entrega_id:'pend'+i,matricula_id:'m3',tipo_entrega:'MANUAL_ESTAGIO',status:'Pendente'})),
  ...Array.from({length:9},(_,i)=>({entrega_id:'na'+i,matricula_id:'m4',tipo_entrega:'DOCUMENTACAO_EXTERNA',status:'Não se aplica'})),
] as Entrega[];
const legacy: Documento[] = [{documento_id:'d1',matricula_id:'fora',tipo:'TCLE',status:'PENDENTE',data_entrega:'',observacao:''}];
const resultado = resumirDocumentacaoOficial(entregas,legacy);
assert.equal(resultado.total,258);
assert.equal(resultado.pendentes,6);
assert.equal(resultado.conferir,128);
assert.equal(resultado.enviados,80);
assert.equal(resultado.entregues,35);
assert.equal(resultado.naoSeAplica,9);
assert.equal(resumirDocumentacaoOficial(entregas,legacy,new Set(['m3'])).pendentes,6);
assert.equal(resumirDocumentacaoOficial(entregas,legacy,new Set(['m1'])).conferir,0);
assert.equal(documentosPendentesOficiais(entregas,legacy).length,6);
assert(documentosPendentesOficiais(entregas,legacy).every(d=>d.documento_id.startsWith('entrega-')));
assert.equal(resumirDocumentacaoOficial([],legacy).pendentes,1);
assert.equal(documentosPendentesOficiais([],legacy).length,1);
console.log('Documentação: 258 entregas e fallback testados com status separados.');
