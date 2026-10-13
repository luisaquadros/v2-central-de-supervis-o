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

// ---------------------------------------------------------------------------
// Resumo e quadro de documentos por turma
// ---------------------------------------------------------------------------

const tipoDaEntrega = (e: Entrega) =>
  String(e.tipo_documento ?? e.tipo_entrega ?? e.codigo_entrega ?? '').trim().toUpperCase();

export const rotuloDoTipoDocumento = (tipo: string): string =>
  ROTULO_TIPO[tipo.toUpperCase()] ?? (tipo ? tipo.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Documento');

export interface ResumoDocumento {
  tipo: string;
  rotulo: string;
  total: number;
  /** Ainda não entregaram (Pendente ou sem status reconhecido). */
  naoEntregaram: number;
  aConferir: number;
  entregues: number;
  naoSeAplica: number;
}

/** Por tipo de documento, quantos estudantes da turma ainda não entregaram. Ordem: Termo, Manual, demais. */
export function resumirDocumentosDaTurma(entregas: Entrega[], matriculaIds: ReadonlySet<string>): ResumoDocumento[] {
  const porTipo = new Map<string, ResumoDocumento>();
  for (const e of entregas) {
    const mid = String(e.matricula_id ?? '').trim();
    if (!mid || !matriculaIds.has(mid)) continue;
    const tipo = tipoDaEntrega(e);
    if (!tipo) continue;
    const r = porTipo.get(tipo) ?? { tipo, rotulo: rotuloDoTipoDocumento(tipo), total: 0, naoEntregaram: 0, aConferir: 0, entregues: 0, naoSeAplica: 0 };
    const sit = interpretarStatusEntrega(e.status_entrega ?? e.status);
    r.total++;
    if (sit === 'NAO_SE_APLICA') r.naoSeAplica++;
    else if (sit === 'A_CONFERIR') r.aConferir++;
    else if (sit === 'ENTREGUE' || sit === 'ENVIADO') r.entregues++;
    else r.naoEntregaram++;
    porTipo.set(tipo, r);
  }
  const ordem = ['TERMO_COMPROMISSO', 'MANUAL_ESTAGIO'];
  return [...porTipo.values()].sort((a, b) => {
    const ia = ordem.indexOf(a.tipo), ib = ordem.indexOf(b.tipo);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.rotulo.localeCompare(b.rotulo, 'pt-BR');
  });
}

/** Frase curta: "4 alunos não entregaram: Termo de Compromisso". */
export function frasesDeDocumentosFaltando(resumo: ResumoDocumento[]): string[] {
  return resumo.filter(r => r.naoEntregaram > 0).map(r =>
    `${r.naoEntregaram} ${r.naoEntregaram === 1 ? 'aluno não entregou' : 'alunos não entregaram'}: ${r.rotulo}`);
}

export interface CelulaDocumento {
  entregaId: string | null;
  tipo: string;
  situacao: ReturnType<typeof interpretarStatusEntrega> | 'SEM_REGISTRO';
  marcado: boolean;
  statusOriginal: string;
}

/** Quadro estudante × documento da turma. Sem registro na planilha = não marcado (e será criado ao marcar). */
export function quadroDeDocumentos(entregas: Entrega[], matriculaIds: string[]): { tipos: { tipo: string; rotulo: string }[]; linhas: { matriculaId: string; celulas: CelulaDocumento[] }[] } {
  const ids = new Set(matriculaIds);
  const tiposVistos = new Map<string, string>();
  for (const e of entregas) {
    if (!ids.has(String(e.matricula_id ?? '').trim())) continue;
    const t = tipoDaEntrega(e);
    if (t) tiposVistos.set(t, rotuloDoTipoDocumento(t));
  }
  const ordem = ['TERMO_COMPROMISSO', 'MANUAL_ESTAGIO'];
  const tipos = [...tiposVistos.entries()].map(([tipo, rotulo]) => ({ tipo, rotulo }))
    .sort((a, b) => ((ordem.indexOf(a.tipo) + 1) || 99) - ((ordem.indexOf(b.tipo) + 1) || 99) || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  const linhas = matriculaIds.map(matriculaId => ({
    matriculaId,
    celulas: tipos.map(({ tipo }): CelulaDocumento => {
      const e = entregas.find(x => String(x.matricula_id ?? '').trim() === matriculaId && tipoDaEntrega(x) === tipo);
      if (!e) return { entregaId: null, tipo, situacao: 'SEM_REGISTRO', marcado: false, statusOriginal: '' };
      const situacao = interpretarStatusEntrega(e.status_entrega ?? e.status);
      return {
        entregaId: String(e.entrega_id ?? ''), tipo, situacao,
        marcado: situacao === 'ENTREGUE' || situacao === 'ENVIADO',
        statusOriginal: String(e.status_entrega ?? e.status ?? '').trim(),
      };
    }),
  }));
  return { tipos, linhas };
}
