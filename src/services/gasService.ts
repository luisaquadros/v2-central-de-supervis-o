/**
 * CENTRAL DE SUPERVISÃO - SERVIÇO DE COMUNICAÇÃO COM O GOOGLE APPS SCRIPT
 *
 * Utiliza o canal nativo seguro google.script.run quando executado diretamente
 * dentro do Web App no Google Apps Script/Google Drive com permissão "Somente Eu".
 * No ambiente de desenvolvimento (AI Studio), permite simulação ou fallback sem perder a interatividade.
 */

import {
  Periodo,
  Disciplina,
  Turma,
  Aluno,
  Matricula,
  HorarioTurma,
  TurmaOrigem,
  Orientacao,
  CriterioAvaliacao,
  Configuracao,
  MarcoAcademico,
  PontoAcompanhamento,
  Frequencia,
  Documento,
  RegistroSemanal,
  Avaliacao,
  FeedbackAluno,
  Ocorrencia,
  RegraRss,
  CalendarioRss,
  StatusRssUnidade,
  SituacaoAtualTurma,
  LeituraResponsavel,
  RegraPrazo,
  GrupoPratica,
  GrupoIntegrante,
  Entrega,
  Feedback,
  RegistroSupervisao,
  Sincronizacao,
  DicionarioDado,
  ContratoApp,
  MapeamentoFonte,
  AuditoriaBase,
} from '../types';

export const OFFICIAL_SPREADSHEET_ID = '1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';
export const OFFICIAL_SPREADSHEET_NAME = 'Central de Supervisão - DESENVOLVIMENTO';
export const OFFICIAL_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${OFFICIAL_SPREADSHEET_ID}`;

export interface DadosIniciaisGas {
  periodos: Periodo[];
  disciplinas: Disciplina[];
  turmas: Turma[];
  horarios: HorarioTurma[];
  turmasOrigem: TurmaOrigem[];
  alunos: Aluno[];
  matriculas: Matricula[];
  criterios: CriterioAvaliacao[];
  orientacoes: Orientacao[];
  configuracoes: Configuracao[];
  marcos: MarcoAcademico[];
  pontosAcompanhamento: PontoAcompanhamento[];
  frequencias: Frequencia[];
  documentos: Documento[];
  registrosSemanais: RegistroSemanal[];
  avaliacoes: Avaliacao[];
  feedbacks: FeedbackAluno[];
  ocorrencias: Ocorrencia[];
  // 12 Tabelas Adicionais Normalizadas
  regrasRss?: RegraRss[];
  calendarioRss?: CalendarioRss[];
  statusRssUnidades?: StatusRssUnidade[];
  situacaoAtualTurmas?: SituacaoAtualTurma[];
  leiturasResponsaveis?: LeituraResponsavel[];
  regrasPrazo?: RegraPrazo[];
  gruposPratica?: GrupoPratica[];
  grupoIntegrantes?: GrupoIntegrante[];
  entregas?: Entrega[];
  feedbacksOficiais?: Feedback[];
  registrosSupervisao?: RegistroSupervisao[];
  sincronizacao?: Sincronizacao[];
  // Documentação e Contrato da Base Oficial
  dicionarioDados?: DicionarioDado[];
  contratoApp?: ContratoApp[];
  mapeamentoFontes?: MapeamentoFonte[];
  auditoriaBase?: AuditoriaBase[];
}

export function isRunningInAppsScript(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).google !== 'undefined' &&
    typeof (window as any).google.script !== 'undefined' &&
    typeof (window as any).google.script.run !== 'undefined'
  );
}

/**
 * Executa uma função no backend Google Apps Script usando Promises nativas
 */
export function callGasFunction<T>(functionName: string, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isRunningInAppsScript()) {
      reject(new Error('Ambiente Google Apps Script não detectado'));
      return;
    }

    const runner = (window as any).google.script.run
      .withSuccessHandler((response: T) => resolve(response))
      .withFailureHandler((error: any) => {
        const errorMsg = error?.message || (typeof error === 'string' ? error : 'Erro de execução no Google Sheets');
        reject(new Error(errorMsg));
      });

    if (typeof runner[functionName] !== 'function') {
      reject(new Error(`Função "${functionName}" não encontrada no Codigo.gs`));
      return;
    }

    runner[functionName](...args);
  });
}

// ==========================================
// OPERAÇÕES DE LEITURA E GRAVAÇÃO SHEETS
// ==========================================

/**
 * Busca todos os dados da planilha Google Sheets em lote via Apps Script
 */
export async function carregarDadosDoSheets(): Promise<DadosIniciaisGas> {
  return await callGasFunction<DadosIniciaisGas>('getDadosIniciais');
}

/**
 * Salva uma nova orientação diretamente na aba orientacoes do Google Sheets
 */
export async function salvarOrientacaoNoSheets(payload: {
  matricula_id: string;
  categoria: string;
  texto: string;
  status: 'ABERTA' | 'CONCLUÍDA';
}): Promise<Orientacao> {
  return await callGasFunction<Orientacao>('salvarNovaOrientacao', payload);
}

export async function toggleOrientacaoStatusNoSheets(
  orientacaoId: string,
  novoStatus: 'ABERTA' | 'CONCLUÍDA'
): Promise<void> {
  await callGasFunction<void>('atualizarStatusOrientacao', orientacaoId, novoStatus);
}

export async function deleteOrientacaoNoSheets(orientacaoId: string): Promise<void> {
  await callGasFunction<void>('excluirOrientacao', orientacaoId);
}

export async function salvarFeedbackNoSheets(payload: {
  matricula_id: string;
  texto: string;
}): Promise<FeedbackAluno> {
  return await callGasFunction<FeedbackAluno>('salvarFeedback', payload);
}

export async function deleteFeedbackNoSheets(feedbackId: string): Promise<void> {
  await callGasFunction<void>('excluirFeedback', feedbackId);
}

export async function salvarOcorrenciaNoSheets(payload: {
  matricula_id: string;
  tipo: 'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'OUTRO';
  observacao: string;
}): Promise<Ocorrencia> {
  return await callGasFunction<Ocorrencia>('salvarOcorrencia', payload);
}

export async function deleteOcorrenciaNoSheets(ocorrenciaId: string): Promise<void> {
  await callGasFunction<void>('excluirOcorrencia', ocorrenciaId);
}

export async function salvarPontoAcompanhamentoNoSheets(payload: {
  matricula_id: string;
  texto: string;
  prioridade?: 'ALTA' | 'MEDIA' | 'BAIXA' | '';
}): Promise<PontoAcompanhamento> {
  return await callGasFunction<PontoAcompanhamento>('salvarPontoAcompanhamento', payload);
}

export async function togglePontoStatusNoSheets(
  pontoId: string,
  novoStatus: 'ATIVO' | 'CONCLUIDO',
  dataConclusao?: string
): Promise<void> {
  await callGasFunction<void>('atualizarStatusPonto', pontoId, novoStatus, dataConclusao);
}

export async function deletePontoAcompanhamentoNoSheets(pontoId: string): Promise<void> {
  await callGasFunction<void>('excluirPontoAcompanhamento', pontoId);
}

export async function salvarRegistroSemanalNoSheets(payload: {
  matricula_id: string;
  semana: number;
  status: 'ENTREGUE' | 'FALTANTE' | 'PENDENTE_REVISAO';
  observacao?: string;
}): Promise<RegistroSemanal> {
  return await callGasFunction<RegistroSemanal>('salvarRegistroSemanal', payload);
}

export async function salvarDocumentoNoSheets(payload: {
  matricula_id: string;
  tipo: string;
  status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE';
  observacao?: string;
}): Promise<Documento> {
  return await callGasFunction<Documento>('salvarDocumento', payload);
}

export async function updateDocumentoNoSheets(
  documentoId: string,
  status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE',
  observacao?: string
): Promise<void> {
  await callGasFunction<void>('atualizarDocumento', documentoId, status, observacao);
}

export async function salvarFrequenciaNoSheets(payload: {
  matricula_id: string;
  data_aula: string;
  status: Frequencia['status'];
  justificativa?: string;
  origem_id?: string;
}): Promise<Frequencia> {
  return await callGasFunction<Frequencia>('salvarFrequencia', payload);
}

export async function updateFrequenciaStatusNoSheets(
  frequenciaId: string,
  status: Frequencia['status'],
  justificativa?: string
): Promise<void> {
  await callGasFunction<void>('atualizarFrequencia', frequenciaId, status, justificativa);
}

export async function salvarAvaliacaoNoSheets(payload: {
  matricula_id: string;
  criterio_id: string;
  nota: number;
  observacao?: string;
}): Promise<Avaliacao> {
  return await callGasFunction<Avaliacao>('salvarAvaliacao', payload);
}

export async function salvarTurmaNoSheets(payload: {
  turma_id?: string;
  periodo_id: string;
  disciplina_id: string;
  nome: string;
  turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
  status: 'ATIVO' | 'ENCERRADO' | 'ARQUIVADO';
  horarios?: Omit<HorarioTurma, 'horario_id' | 'turma_id'>[];
  origens?: Omit<TurmaOrigem, 'origem_id' | 'turma_id'>[];
}): Promise<Turma> {
  return await callGasFunction<Turma>('salvarTurma', payload);
}

export async function arquivarTurmaNoSheets(
  turmaId: string,
  novoStatus: 'ATIVO' | 'ARQUIVADO' | 'ENCERRADO'
): Promise<void> {
  await callGasFunction<void>('atualizarStatusTurma', turmaId, novoStatus);
}

export async function salvarNovoPeriodoNoSheets(payload: {
  nome: string;
  data_inicio: string;
  data_fim: string;
  copiarTurmasDePeriodoId?: string;
}): Promise<Periodo> {
  return await callGasFunction<Periodo>('salvarNovoPeriodo', payload);
}

export async function importarAlunosLoteNoSheets(payload: {
  turma_id: string;
  periodo_id: string;
  alunos: { nome: string; identificador_academico: string }[];
}): Promise<{ adicionados: number; duplicados: number }> {
  return await callGasFunction<{ adicionados: number; duplicados: number }>('importarAlunosLote', payload);
}
