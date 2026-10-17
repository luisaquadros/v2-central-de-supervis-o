import assert from 'node:assert/strict';
import { resumirDocumentacaoOficial, documentosPendentesOficiais, entregasDoEstudante } from '../services/documentacaoAcademicaService';
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
// Ficha do estudante: entregas oficiais da própria matrícula, com rótulo legível e status original.
{
  const lista = entregasDoEstudante([
    { entrega_id: 'e1', matricula_id: 'm9', tipo_entrega: 'TERMO_COMPROMISSO', status: 'A conferir', prazo: '2026-09-04' },
    { entrega_id: 'e2', matricula_id: 'm9', codigo_entrega: 'MANUAL_ESTAGIO', status: 'Enviado', data_envio: '2026-08-20' },
    { entrega_id: 'e3', matricula_id: 'm9', tipo_documento: 'RELATORIO_PARCIAL', status: 'Pendente' },
    { entrega_id: 'e4', matricula_id: 'outra', tipo_entrega: 'TERMO_COMPROMISSO', status: 'Pendente' },
  ] as any, 'm9');
  assert.equal(lista.length, 3, 'só entregas da matrícula pedida');
  assert.deepEqual(lista.map(x => x.rotulo), ['Manual do Estágio', 'Relatório parcial', 'Termo de Compromisso']);
  assert.equal(lista.find(x => x.id === 'e1')!.situacao, 'A_CONFERIR');
  assert.equal(lista.find(x => x.id === 'e1')!.statusOriginal, 'A conferir', 'status original preservado');
  assert.equal(lista.find(x => x.id === 'e2')!.dataEnvio, '2026-08-20');
  assert.equal(entregasDoEstudante([], 'm9').length, 0);
}
console.log('Documentação: 258 entregas, fallback e ficha do estudante testados com status separados.');
