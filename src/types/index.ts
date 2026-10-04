/**
 * CENTRAL DE SUPERVISÃO - MODELO DE DADOS (18 TABELAS NORMALIZADAS)
 */

export interface Periodo {
  periodo_id: string;
  nome: string; // Ex: '2026.2', '2027.1'
  data_inicio: string; // YYYY-MM-DD
  data_fim: string; // YYYY-MM-DD
  status: 'ATIVO' | 'PLANEJADO' | 'ARQUIVADO';
}

export interface Disciplina {
  disciplina_id: string;
  codigo: string; // Ex: 'CLI-01'
  nome: string; // Ex: 'Clínica Adulto'
  tipo: string; // Ex: 'ESTÁGIO'
}

export interface Turma {
  turma_id: string;
  periodo_id: string;
  disciplina_id: string;
  nome: string; // Ex: 'Clínica Adulto - Manhã'
  turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
  status: 'ATIVO' | 'ENCERRADO' | 'ARQUIVADO';
}

export interface Aluno {
  aluno_id: string;
  nome: string;
  identificador_academico: string; // Ex: 'RA202601'
  status: 'ATIVO' | 'TRANCADO' | 'CONCLUIDO';
}

export interface Matricula {
  matricula_id: string;
  aluno_id: string;
  turma_id: string;
  periodo_id: string;
  status: 'MATRICULADO' | 'TRANCADO' | 'CANCELADO';
}

export interface Orientacao {
  orientacao_id: string;
  matricula_id: string;
  data_hora: string; // ISO string
  categoria: 'Geral' | 'Clínica' | 'Ética' | 'Metodologia' | 'Relatório' | 'Manejo' | string;
  texto: string;
  status: 'ABERTA' | 'CONCLUÍDA';
  criado_em: string;
  atualizado_em: string;
}

export interface RegistroSemanal {
  registro_id: string;
  matricula_id: string;
  semana: number; // 1 a 12 (configurável)
  status: 'ENTREGUE' | 'FALTANTE' | 'PENDENTE_REVISAO';
  data_entrega: string; // YYYY-MM-DD ou vazio
  observacao: string;
}

export interface Documento {
  documento_id: string;
  matricula_id: string;
  tipo: 'TCLE' | 'Termo de Compromisso' | 'Ficha de Matrícula' | 'Relatório de Atendimento' | 'Declaração da Instituição' | string;
  status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE';
  data_entrega: string;
  observacao: string;
}

export interface Avaliacao {
  avaliacao_id: string;
  matricula_id: string;
  criterio_id: string;
  nota: number;
  observacao: string;
}

export interface FeedbackAluno {
  feedback_id: string;
  matricula_id: string;
  data_hora: string;
  texto: string;
}

export interface CriterioAvaliacao {
  criterio_id: string;
  periodo_id?: string;
  disciplina_id?: string;
  turma_id?: string;
  instrumento_avaliacao?: string; // Varia por instrumento de avaliação
  instrumento?: string;
  nome: string;
  nota_maxima: number;
  peso?: number;
  ordem?: number;
  ativo?: boolean;
  [key: string]: any;
}

// -----------------------------------------------------------------------------
// TABELAS NORMALIZADAS ADICIONAIS DA PLANILHA OFICIAL (Materializadas na base)
// -----------------------------------------------------------------------------

export interface RegraRss {
  regra_id?: string;
  disciplina_id?: string;
  turma_id?: string;
  total_esperado?: number;
  [key: string]: any;
}

export interface CalendarioRss {
  calendario_id?: string;
  turma_id?: string;
  semana?: number;
  data_prevista?: string;
  data_limite?: string;
  [key: string]: any;
}

export interface StatusRssUnidade {
  turma_id: string;
  unidade_id: string;
  unidade_tipo: 'INDIVIDUAL' | 'GRUPO' | string;
  unidade_nome?: string;
  rss_esperados_ate_hoje?: number;
  rss_recebidos_validos?: number;
  saldo_rss?: number;
  status_rss?: string;
  atualizado_em?: string;
  [key: string]: any;
}

export interface SituacaoAtualTurma {
  turma_id: string;
  periodo_id?: string;
  disciplina_id?: string;
  situacao?: string; // Materializado na planilha oficial
  total_alunos?: number;
  total_pendencias?: number;
  [key: string]: any;
}

export interface LeituraResponsavel {
  leitura_id?: string;
  turma_id?: string;
  data?: string;
  tema?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  aluno_id?: string;
  [key: string]: any;
}

export interface RegraPrazo {
  prazo_id?: string;
  tipo?: string;
  dias_tolerancia?: number;
  descricao?: string;
  [key: string]: any;
}

export interface GrupoPratica {
  grupo_id: string;
  turma_id?: string;
  nome_grupo?: string;
  descricao?: string;
  [key: string]: any;
}

export interface GrupoIntegrante {
  integrante_id?: string;
  grupo_id: string;
  aluno_id?: string;
  matricula_id?: string;
  papel?: string;
  [key: string]: any;
}

export interface Entrega {
  entrega_id?: string;
  matricula_id?: string;
  tipo_documento?: string;
  status_entrega?: string;
  data_entrega?: string;
  observacao?: string;
  [key: string]: any;
}

export interface Feedback {
  feedback_id: string;
  matricula_id?: string;
  aluno_id?: string;
  data_hora?: string;
  texto?: string;
  [key: string]: any;
}

export interface RegistroSupervisao {
  registro_id?: string;
  orientacao_id?: string;
  matricula_id?: string;
  data_hora?: string;
  categoria?: string;
  texto?: string;
  status?: string;
  [key: string]: any;
}

export interface Sincronizacao {
  sincronizacao_id?: string;
  tabela?: string;
  ultima_atualizacao?: string;
  versao?: string;
  status?: string;
  [key: string]: any;
}

// -----------------------------------------------------------------------------
// DOCUMENTAÇÃO E CONTRATO OFICIAL DA BASE
// -----------------------------------------------------------------------------

export interface DicionarioDado {
  tabela?: string;
  campo?: string;
  tipo?: string;
  descricao?: string;
  obrigatorio?: boolean;
  origem?: string;
  [key: string]: any;
}

export interface ContratoApp {
  chave?: string;
  modulo?: string;
  descricao?: string;
  regra?: string;
  tipo?: string;
  [key: string]: any;
}

export interface MapeamentoFonte {
  tabela_destino?: string;
  campo_destino?: string;
  aba_origem?: string;
  coluna_origem?: string;
  regra_transformacao?: string;
  [key: string]: any;
}

export interface AuditoriaBase {
  auditoria_id?: string;
  timestamp?: string;
  usuario?: string;
  acao?: string;
  detalhes?: string;
  [key: string]: any;
}

export interface Ocorrencia {
  ocorrencia_id: string;
  matricula_id: string;
  data_hora: string;
  tipo: 'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'OUTRO';
  observacao: string;
}

export interface Configuracao {
  configuracao_id: string;
  chave: string;
  valor: string;
  periodo_id?: string;
  disciplina_id?: string;
  turma_id?: string;
}

export interface TurmaOrigem {
  origem_id: string;
  turma_id: string;
  sistema: string; // 'Docente Online'
  codigo_externo: string; // Ex: 'PSIC-101-A'
  nome_externo: string; // Ex: 'Estágio Clínica Adulto A'
  ativo: boolean;
}

export interface Frequencia {
  frequencia_id: string;
  matricula_id: string;
  data_aula: string; // YYYY-MM-DD
  status: 'PRESENTE' | 'FALTA_SEM_JUSTIFICATIVA' | 'FALTA_JUSTIFICADA' | 'JUSTIFICATIVA_PENDENTE';
  justificativa: string;
  origem_id: string; // FK -> TurmaOrigem
  criado_em: string;
  atualizado_em: string;
}

export interface HorarioTurma {
  horario_id: string;
  turma_id: string;
  dia_semana: number; // 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
  hora_inicio: string; // '08:20'
  hora_fim: string; // '11:00'
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
}

export interface PontoAcompanhamento {
  ponto_id: string;
  matricula_id: string;
  texto: string; // Ex: 'Revisar formulação do caso clínico'
  status: 'ATIVO' | 'CONCLUIDO';
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA' | '';
  data_criacao: string;
  atualizado_em: string;
  data_conclusao?: string;
}

export interface MarcoAcademico {
  marco_id: string;
  periodo_id: string;
  disciplina_id?: string;
  turma_id?: string;
  nome: string; // Ex: 'Final dos atendimentos'
  tipo: 'PROVA' | 'ENTREGA' | 'RELATORIO' | 'ENCERRAMENTO_ATENDIMENTOS' | 'DEVOLUTIVA' | 'OUTRO';
  data_prazo: string;
  status: 'PENDENTE' | 'CONCLUIDO';
  observacao?: string;
}

// Helpers / View models
export interface AlunoResumoSupervisao {
  matricula: Matricula;
  aluno: Aluno;
  turma: Turma;
  disciplina: Disciplina;
  totalRegistrosEntregues: number;
  totalRegistrosEsperados: number;
  docsPendentesCount: number;
  faltasInjustificadasCount: number;
  orientacoesAbertasCount: number;
  justificativasPendentesCount: number;
  temAtencao: boolean;
  statusAtencao: 'NORMAL' | 'ATENCAO' | 'PRIORIDADE';
  motivosAtencao: string[];
  pontosAtivos: PontoAcompanhamento[];
  ultimasOrientacoes: Orientacao[];
  ultimasOcorrencias: Ocorrencia[];
}

// Central de Avaliação e Instrumentos
export type TipoInstrumento = 'NOTA_SIMPLES' | 'ATIVIDADE_SIMPLES' | 'RUBRICA' | 'HIBRIDA';

export interface InstrumentoAvaliacao {
  instrumento_id: string;
  turma_id?: string;
  disciplina_id?: string;
  periodo_id?: string;
  nome: string;
  tipo: TipoInstrumento;
  nota_maxima: number;
  peso?: number;
  data_limite?: string;
  descricao?: string;
}

export type StatusDevolutiva =
  | 'NAO_INICIADA'
  | 'RASCUNHO'
  | 'AVALIADA'
  | 'FEEDBACK_PREPARADO'
  | 'AGUARDANDO_REVISAO'
  | 'APROVADO_ENVIO'
  | 'ENVIADO';

export interface NotaCriterioItem {
  criterio_id: string;
  criterio_nome: string;
  nota: number;
  nota_maxima: number;
  comentario?: string;
  pontos_fortes?: string;
  pontos_desenvolver?: string;
}

export interface AvaliacaoCompleta {
  avaliacao_id: string;
  matricula_id: string;
  aluno_id?: string;
  turma_id: string;
  instrumento_id: string;
  tipo_instrumento: TipoInstrumento;
  nota_final: number;
  nota_maxima: number;
  status: StatusDevolutiva;
  notas_criterios?: NotaCriterioItem[];
  comentario_geral?: string;
  pontos_fortes?: string;
  pontos_desenvolver?: string;
  feedback_gerado?: string;
  arquivo_referencia?: string;
  data_avaliacao?: string;
  data_aprovacao?: string;
  data_envio?: string;
  atualizado_em: string;
}

// Caixa de Entrada Global e Registro Rápido
export interface CaixaEntradaItem {
  id: string;
  texto_original: string;
  criado_em: string;
  status: 'PENDENTE' | 'CLASSIFICADO' | 'CONFIRMADO' | 'DESCARTADO';
  tipo_sugerido?: string;
  aluno_id?: string;
  matricula_id?: string;
  grupo_id?: string;
  turma_id?: string;
  data_relacionada?: string;
  observacao?: string;
  canal?: string;
  confianca_ia?: number;
  motivo_pendente?: string;
  resolvido_em?: string;
}

// Fila da Professora ("Minha Fila")
export interface ItemFilaProfessora {
  id: string;
  titulo: string;
  duracao_minutos: 5 | 15 | 30 | number;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  turma_id?: string;
  matricula_id?: string;
  grupo_id?: string;
  categoria: string; // Ex: 'RSS', 'Documentos', 'Orientação', 'Avaliação', 'Geral'
  prazo?: string;
  observacao?: string;
  criado_em: string;
}

// Fila de Supervisão (Modo Aula)
export interface ItemFilaSupervisao {
  id: string;
  turma_id: string;
  alvo_tipo: 'ALUNO' | 'GRUPO' | 'TURMA';
  alvo_id: string;
  nome_alvo: string;
  assunto: string;
  status: 'AGUARDANDO' | 'EM_DISCUSSAO' | 'ORIENTACAO_REGISTRADA' | 'CONCLUIDO';
  ordem: number;
  criado_em: string;
}

// Notificações Agregadas
export interface NotificacaoAgregada {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'AULA' | 'LEITURA' | 'PRAZO' | 'RSS' | 'ORIENTACAO' | 'DOCUMENTO' | 'FECHAMENTO';
  nivel: 'INFO' | 'ATENCAO' | 'CRITICO';
  turma_id?: string;
  lida: boolean;
  linkTab?: string;
  linkParam?: string;
  criado_em: string;
}

// Histórico de Auditoria do App
export interface HistoricoAuditoria {
  id: string;
  timestamp: string;
  usuario: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  valor_anterior?: string;
  valor_novo?: string;
  motivo?: string;
}

// Navegação do aplicativo
export type NavTab =
  | 'hoje'
  | 'dashboard'
  | 'turmas'
  | 'alunos'
  | 'avaliacao'
  | 'calendario'
  | 'pendencias'
  | 'frequencia'
  | 'semestres'
  | 'configuracoes';

