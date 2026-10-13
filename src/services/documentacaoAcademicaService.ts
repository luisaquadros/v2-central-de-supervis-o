import type { Entrega, Documento } from '../types';
import { interpretarStatusEntrega } from './normalizacaoAcademica';

export function resumirDocumentacaoOficial(
  entregas: Entrega[],
  legados: Documento[],
  matriculas?: ReadonlySet<string>,
) {
  const oficiais = entregas.length > 0;
  const rows = oficiais ? entregas.filter(e => e.matricula_id && (!matriculas || matriculas.has(e.matricula_id)))
    .map(e => interpretarStatusEntrega(e.status_entrega ?? e.status)) :
    legados.filter(d => !matriculas || matriculas.has(d.matricula_id))
      .map(d => d.status === 'ENTREGUE' ? 'ENTREGUE' :
        d.status === 'PENDENTE' ? 'PENDENTE' :
        d.status === 'EM_ANALISE' ? 'A_CONFERIR' : 'DESCONHECIDO');
  return {
    fonte: oficiais ? 'entregas' : 'documentos',
    total: rows.length,
    pendentes: rows.filter(x => x === 'PENDENTE').length,
    conferir: rows.filter(x => x === 'A_CONFERIR').length,
    enviados: rows.filter(x => x === 'ENVIADO').length,
    entregues: rows.filter(x => x === 'ENTREGUE').length,
    naoSeAplica: rows.filter(x => x === 'NAO_SE_APLICA').length,
    desconhecidos: rows.filter(x => x === 'DESCONHECIDO').length,
  };
}

/** Para notificações, só "Pendente" é falta documentada. "A conferir" não é falta. */
export function documentosPendentesOficiais(entregas: Entrega[], legados: Documento[]): Documento[] {
  if (!entregas.length) return legados.filter(d => d.status === 'PENDENTE');
  return entregas.filter(e => e.matricula_id &&
      interpretarStatusEntrega(e.status_entrega ?? e.status) === 'PENDENTE')
    .map(e => ({
      documento_id: 'entrega-' + String(e.entrega_id || [e.matricula_id, e.tipo_entrega || e.tipo_documento].join(':')),
      matricula_id: String(e.matricula_id),
      tipo: String(e.tipo_entrega ?? e.tipo_documento ?? 'Documento acadêmico').replaceAll('_',' '),
      status: 'PENDENTE' as const,
      data_entrega: String(e.data_envio ?? e.data_entrega ?? ''),
      observacao: String(e.observacao ?? 'Pendente conforme Central de Controle'),
    }));
}
