/**
 * Leitura dos METADADOS de documentos do Drive (aba monitoramento_documentos).
 * Regras (PRD/adendo §5–6):
 *  - "recente" = modificado na janela (padrão 7 dias, configurável e separada da janela do RSS);
 *  - recente NÃO é entrega, versão correta nem qualidade: a tela nunca usa essa informação para marcar entregue;
 *  - nunca abre conteúdo nem mostra nome/link do arquivo;
 *  - documento coletivo (Clínica Ampliada) aparece uma vez, no grupo; individual (Consultoria) por matrícula;
 *  - falta de permissão é diferente de arquivo ausente.
 */
import type { MonitoramentoDocumento } from '../types';
import { rotuloDoTipoDocumento } from './documentacaoAcademicaService';

export const JANELA_DOCUMENTOS_PADRAO_DIAS = 7;
export type SituacaoDrive = 'LOCALIZADO_RECENTE' | 'LOCALIZADO_ANTIGO' | 'NAO_ENCONTRADO_NA_PASTA' | 'SEM_PERMISSAO' | 'NAO_VERIFICADO' | 'A_CONFERIR';
export type TitularTipo = 'MATRICULA' | 'GRUPO';

export const ROTULO_SITUACAO: Record<SituacaoDrive, string> = {
  LOCALIZADO_RECENTE: 'Alterado recentemente',
  LOCALIZADO_ANTIGO: 'Sem alteração recente',
  NAO_ENCONTRADO_NA_PASTA: 'Não encontrado na pasta',
  SEM_PERMISSAO: 'Sem permissão de leitura',
  NAO_VERIFICADO: 'Ainda não verificado',
  A_CONFERIR: 'A conferir',
};
/** Texto que evita ler "recente" como "entregue". */
export const AVISO_MODIFICACAO = 'A data mostra quando o arquivo foi alterado no Drive. Não indica entrega, versão correta nem qualidade do documento.';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (v: unknown) => semAcento(String(v ?? '')).trim().toUpperCase().replace(/[\s-]+/g, '_');

export function titularTipoDe(v: unknown): TitularTipo | null {
  const t = norm(v);
  if (['MATRICULA', 'ALUNO', 'ESTUDANTE', 'INDIVIDUAL', 'PESSOA'].includes(t)) return 'MATRICULA';
  if (['GRUPO', 'GRUPO_PRATICA', 'COLETIVO'].includes(t)) return 'GRUPO';
  return null;
}
const SITUACOES = new Set<string>(Object.keys(ROTULO_SITUACAO));

export interface DocumentoMonitorado {
  id: string; tipo: string; rotulo: string;
  titularTipo: TitularTipo | null; titularId: string; turmaId: string;
  situacao: SituacaoDrive; modificadoEm: string; consultadoEm: string; erro: string; validacaoManual: string;
}

const dataValida = (v: string): number => { const t = Date.parse(v); return Number.isFinite(t) ? t : NaN; };
/** Situação mostrada: a recência é recalculada pela data (o status gravado pode ter envelhecido desde a última consulta). */
export function situacaoEfetiva(r: MonitoramentoDocumento, agora: Date, janelaDias = JANELA_DOCUMENTOS_PADRAO_DIAS): SituacaoDrive {
  const bruto = norm(r.status);
  const mod = String(r.data_modificacao_drive ?? '').trim();
  if (bruto === 'NAO_ENCONTRADO_NA_PASTA' || bruto === 'SEM_PERMISSAO' || bruto === 'A_CONFERIR') return bruto as SituacaoDrive;
  if (bruto === 'LOCALIZADO_RECENTE' || bruto === 'LOCALIZADO_ANTIGO') {
    const t = dataValida(mod);
    if (!Number.isFinite(t)) return 'A_CONFERIR';
    return agora.getTime() - t <= janelaDias * 86_400_000 ? 'LOCALIZADO_RECENTE' : 'LOCALIZADO_ANTIGO';
  }
  if (!bruto || bruto === 'NAO_VERIFICADO') return 'NAO_VERIFICADO';
  return 'A_CONFERIR'; // valor desconhecido: nunca presumir
}

export function normalizarMonitoramento(r: MonitoramentoDocumento, agora: Date, janelaDias = JANELA_DOCUMENTOS_PADRAO_DIAS): DocumentoMonitorado {
  const tipo = norm(r.tipo_documento_id);
  return {
    id: String(r.monitoramento_id ?? '').trim() || `${r.titular_id}|${tipo}|${r.arquivo_id}`,
    tipo, rotulo: rotuloDoTipoDocumento(tipo),
    titularTipo: titularTipoDe(r.titular_tipo), titularId: String(r.titular_id ?? '').trim(), turmaId: String(r.turma_id ?? '').trim(),
    situacao: situacaoEfetiva(r, agora, janelaDias),
    modificadoEm: String(r.data_modificacao_drive ?? '').trim(), consultadoEm: String(r.consultado_em ?? '').trim(),
    erro: String(r.erro_codigo ?? '').trim(), validacaoManual: String(r.validacao_manual ?? '').trim(),
  };
}

export interface ContextoMonitoramento {
  matriculasDaTurma: { matricula_id: string }[];
  gruposDaTurma: { grupo_id: string; nome_grupo?: string }[];
}
/** Documentos de uma turma: por turma_id da linha, ou (sem turma_id) pelo titular pertencer à turma. */
export function documentosDaTurma(linhas: MonitoramentoDocumento[], turmaId: string, ctx: ContextoMonitoramento, agora: Date, janelaDias?: number): DocumentoMonitorado[] {
  const mats = new Set(ctx.matriculasDaTurma.map(m => m.matricula_id)), grupos = new Set(ctx.gruposDaTurma.map(g => g.grupo_id));
  return linhas.map(l => normalizarMonitoramento(l, agora, janelaDias)).filter(d =>
    d.turmaId ? d.turmaId === turmaId : (d.titularTipo === 'GRUPO' ? grupos.has(d.titularId) : d.titularTipo === 'MATRICULA' ? mats.has(d.titularId) : false));
}
/** Documentos de um estudante: os individuais da matrícula + os coletivos dos grupos de que faz parte (marcados como coletivos). */
export function documentosDoEstudante(linhas: MonitoramentoDocumento[], matriculaId: string, gruposDoEstudante: string[], agora: Date, janelaDias?: number): { individuais: DocumentoMonitorado[]; coletivos: DocumentoMonitorado[] } {
  const todos = linhas.map(l => normalizarMonitoramento(l, agora, janelaDias));
  const gs = new Set(gruposDoEstudante);
  return {
    individuais: todos.filter(d => d.titularTipo === 'MATRICULA' && d.titularId === matriculaId),
    coletivos: todos.filter(d => d.titularTipo === 'GRUPO' && gs.has(d.titularId)),
  };
}
export const documentosDoGrupo = (linhas: MonitoramentoDocumento[], grupoId: string, agora: Date, janelaDias?: number) =>
  linhas.map(l => normalizarMonitoramento(l, agora, janelaDias)).filter(d => d.titularTipo === 'GRUPO' && d.titularId === grupoId);

export interface ResumoMonitoramento { total: number; porSituacao: Record<SituacaoDrive, number>; comErro: number; desatualizados: number }
/** `desatualizados`: última consulta há mais de `limiteHoras` (sincronização parada ou falhando). */
export function resumirMonitoramento(docs: DocumentoMonitorado[], agora: Date, limiteHoras = 36): ResumoMonitoramento {
  const porSituacao = Object.fromEntries(Object.keys(ROTULO_SITUACAO).map(k => [k, 0])) as Record<SituacaoDrive, number>;
  let comErro = 0, desatualizados = 0;
  for (const d of docs) {
    porSituacao[d.situacao]++;
    if (d.erro && !['DRIVE_404', 'DRIVE_403', 'LIXEIRA', 'FORA_DA_PASTA'].includes(d.erro)) comErro++;
    const t = dataValida(d.consultadoEm);
    if (!Number.isFinite(t) || agora.getTime() - t > limiteHoras * 3_600_000) desatualizados++;
  }
  return { total: docs.length, porSituacao, comErro, desatualizados };
}

export interface ProblemaMonitoramento { nivel: 'ERRO' | 'AVISO'; texto: string }
/** Conferência dos vínculos (somente leitura): ajuda a validar a aba real sem expor conteúdo. */
export function diagnosticarMonitoramento(
  linhas: MonitoramentoDocumento[],
  ctx: { matriculas: { matricula_id: string }[]; grupos: { grupo_id: string }[] },
): ProblemaMonitoramento[] {
  const p: ProblemaMonitoramento[] = [];
  if (!linhas.length) return [{ nivel: 'AVISO', texto: 'A aba monitoramento_documentos não tem linhas.' }];
  const colunas = new Set(Object.keys(linhas[0]));
  const exigidas = ['monitoramento_id', 'turma_id', 'titular_tipo', 'titular_id', 'tipo_documento_id', 'arquivo_id', 'pasta_id', 'data_modificacao_drive', 'consultado_em', 'status', 'erro_codigo'];
  const faltam = exigidas.filter(c => !colunas.has(c));
  if (faltam.length) p.push({ nivel: 'ERRO', texto: `Colunas ausentes: ${faltam.join(', ')}.` });
  const mats = new Set(ctx.matriculas.map(m => m.matricula_id)), grupos = new Set(ctx.grupos.map(g => g.grupo_id));
  const vistos = new Map<string, number>();
  linhas.forEach((l, i) => {
    const n = i + 2, tipo = titularTipoDe(l.titular_tipo), id = String(l.titular_id ?? '').trim();
    if (!tipo) p.push({ nivel: 'ERRO', texto: `Linha ${n}: titular_tipo "${l.titular_tipo ?? ''}" não reconhecido (use MATRICULA ou GRUPO).` });
    else if (!id) p.push({ nivel: 'ERRO', texto: `Linha ${n}: titular_id vazio.` });
    else if (tipo === 'MATRICULA' ? !mats.has(id) : !grupos.has(id)) p.push({ nivel: 'ERRO', texto: `Linha ${n}: ${tipo === 'MATRICULA' ? 'matrícula' : 'grupo'} "${id}" não existe nas tabelas do app.` });
    if (!String(l.arquivo_id ?? '').trim()) p.push({ nivel: 'AVISO', texto: `Linha ${n}: sem arquivo_id (não será consultada).` });
    const status = norm(l.status);
    if (status && !SITUACOES.has(status)) p.push({ nivel: 'AVISO', texto: `Linha ${n}: status "${l.status}" desconhecido (será exibido como "A conferir").` });
    const chave = `${tipo}|${id}|${norm(l.tipo_documento_id)}|${String(l.arquivo_id ?? '').trim()}`;
    if (vistos.has(chave)) p.push({ nivel: 'ERRO', texto: `Linha ${n}: duplica a linha ${vistos.get(chave)} (mesmo titular, tipo e arquivo).` }); else vistos.set(chave, n);
    if (String(l.erro_codigo ?? '').trim()) p.push({ nivel: 'AVISO', texto: `Linha ${n}: erro da última consulta (${l.erro_codigo}).` });
  });
  return p;
}
