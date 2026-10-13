import type { Entrega, Documento } from '../types';
import { interpretarStatusEntrega } from './normalizacaoAcademica';

const ROTULO_TIPO: Record<string, string> = {
  TERMO_COMPROMISSO: 'Termo de Compromisso',
  MANUAL_ESTAGIO: 'Manual do Estágio',
  RELATORIO_PARCIAL: 'Relatório parcial',
  RELATORIO_FINAL: 'Relatório final',
  DOCUMENTACAO_EXTERNA: 'Documentação externa',
};

export interface EntregaDoEstudante {
  id: string;
  rotulo: string;
  situacao: ReturnType<typeof interpretarStatusEntrega>;
  statusOriginal: string;
  prazo: string;
  dataEnvio: string;
}

/** Entregas oficiais (aba `entregas`) de UMA matrícula, prontas para a ficha. Somente leitura. */
export function entregasDoEstudante(entregas: Entrega[], matriculaId: string): EntregaDoEstudante[] {
  return entregas
    .filter(e => String(e.matricula_id ?? '').trim() === matriculaId)
    .map(e => {
      const tipo = String(e.tipo_documento ?? e.tipo_entrega ?? e.codigo_entrega ?? '').trim();
      const statusOriginal = String(e.status_entrega ?? e.status ?? '').trim();
      return {
        id: String(e.entrega_id ?? `${matriculaId}:${tipo}`),
        rotulo: ROTULO_TIPO[tipo.toUpperCase()] ?? (tipo ? tipo.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Documento'),
        situacao: interpretarStatusEntrega(statusOriginal),
        statusOriginal,
        prazo: String(e.prazo ?? '').trim(),
        dataEnvio: String(e.data_entrega ?? e.data_envio ?? '').trim(),
      };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

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
