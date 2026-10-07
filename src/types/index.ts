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
  origem_id?: string; // FK -> TurmaOrigem (Docente Online individual do aluno)
  codigo_origem?: string;
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
  nota_maxima?: number | string;
  peso?: number | string;
  ordem?: number | string;
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
  total_esperado?: number | string;
  [key: string]: any;
}

export interface CalendarioRss {
  rss_previsto_id?: string;
  periodo_id?: string;
  turma_id?: string;
  codigo_origem?: string;
  sequencia?: number | string;
  semana_inicio?: string;
  semana_fim?: string;
  status_calendario?: 'CONCLUIDA' | 'ATUAL' | 'FUTURA' | string;
  obrigatorio_sem_atendimento?: boolean | string;
  fonte?: string;
  observacao?: string;
  // Campos legados para compatibilidade defensiva
  calendario_id?: string;
  semana?: number | string;
  data_prevista?: string;
  data_limite?: string;
  [key: string]: any;
}

export interface StatusRssUnidade {
  turma_id: string;
  unidade_id: string;
  unidade_tipo: 'INDIVIDUAL' | 'GRUPO' | string;
  unidade_nome?: string;
  rss_esperados_ate_hoje?: number | string;
  rss_recebidos_validos?: number | string;
  saldo_rss?: number | string;
  status_rss?: string;
  atualizado_em?: string;
  [key: string]: any;
}

export interface SituacaoAtualTurma {
  turma_id: string;
  turma_nome?: string;
  codigo_origem?: string;
  dia_horario?: string;
  aula_cronograma_atual?: string | number;
  rss_esperados_ate_hoje?: number | string;
  rss_total_previsto?: number | string;
  inicio_atendimentos?: string;
  fim_atendimentos?: string;
  data_proximo_marco?: string;
  proximo_marco?: string;
  unidade_rss?: string;
  total_unidades_rss?: number | string;
  observacao_operacional?: string;
  atualizado_em?: string;
  status_base?: string;
  unidades_em_dia?: number | string;
  unidades_atrasadas?: number | string;
  unidades_sem_exigencia?: number | string;
  // Campos relacionais/derivados
  periodo_id?: string;
  disciplina_id?: string;
  situacao?: string;
  total_alunos?: number;
  total_pendencias?: number;
  [key: string]: any;
}

export interface LeituraResponsavel {
  leitura_id?: string;
  turma_id?: string;
  data?: string;
  tema?: string;
  artigo_leitura?: string;
  referencia_link?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  aluno_id?: string;
  responsaveis_previstos?: string[]; // IDs de matrícula previstos
  status_realizacao?: 'PLANEJADO' | 'REALIZADO' | 'PARCIAL' | 'NAO_REALIZADO' | 'SUBSTITUICAO';
  responsaveis_efetivos?: string[]; // IDs de matrícula que apresentaram
  motivo_substituicao?: string;
  observacao?: string;
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
  atraso?: boolean;
  celular?: boolean;
  observacao?: string;
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
  status_encontro?: 'NORMAL' | 'CANCELADO' | 'REAGENDADO';
  data_reagendada?: string;
  motivo_cancelamento?: string;
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

// Situação canônica de RSS do estudante (resolvida ponta a ponta)
export interface SituacaoRssEstudante {
  matriculaId: string;
  turmaId: string;
  registrosRealizados: number;
  registrosEsperadosAteHoje: number;
  totalPrevistoNoPeriodo: number;
  saldoRss: number;
  statusSemanal: string;
  estaAtrasado: boolean;
  registrosEstudante: RegistroSemanal[];
  textoExibicao: string; // Ex: "3 de 5 esperados até hoje (12 no semestre)"
}

// Helpers / View models
export interface AlunoResumoSupervisao {
  matricula: Matricula;
  aluno: Aluno;
  turma: Turma;
  disciplina: Disciplina;
  totalRegistrosEntregues: number;
  totalRegistrosEsperados: number;
  totalPrevistoNoPeriodo?: number;
  situacaoRss?: SituacaoRssEstudante;
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

// -----------------------------------------------------------------------------
// GESTÃO OPERACIONAL DE ENCONTROS, AULAS NÃO REALIZADAS E REAGENDAMENTOS
// -----------------------------------------------------------------------------
export type StatusEncontro = 'PREVISTO' | 'REALIZADO' | 'NAO_REALIZADO' | 'REAGENDADO';
export type MotivoNaoRealizado =
  | 'Feriado'
  | 'Recesso acadêmico'
  | 'Cancelamento institucional'
  | 'Cancelamento da professora'
  | 'Outro';

export interface EncontroTurma {
  encontro_id: string;
  turma_id: string;
  periodo_id?: string;
  data: string; // YYYY-MM-DD
  hora_inicio?: string;
  hora_fim?: string;
  status: StatusEncontro;
  motivo_nao_realizado?: MotivoNaoRealizado | string;
  observacao?: string;
  data_original?: string;
  data_reagendada?: string;
  hora_reagendada?: string;
  chamada_salva?: boolean;
  total_presentes?: number;
  total_faltas?: number;
  leitura_id?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface NotificacaoDerivada {
  id: string;
  titulo: string;
  mensagem: string;
  categoria: 'REQUER_ACAO' | 'INFORMATIVO';
  tipo:
    | 'CHAMADA_PENDENTE'
    | 'PRAZO_HOJE'
    | 'PRAZO_VENCIDO'
    | 'JUSTIFICATIVA_PENDENTE'
    | 'ESTUDO_DIRIGIDO_PENDENTE'
    | 'DOCUMENTO_PENDENTE'
    | 'SUPERVISAO_HOJE'
    | 'FERIADO'
    | 'MARCO_PROXIMO';
  turma_id?: string;
  turma_nome?: string;
  matricula_id?: string;
  targetTab?: NavTab;
  targetParam?: string;
  criado_em?: string;
}

export interface ItemPendenciaOperacional {
  id: string;
  tipo:
    | 'CHAMADA'
    | 'JUSTIFICATIVA'
    | 'REGISTRO_SEMANAL'
    | 'DOCUMENTO'
    | 'ORIENTACAO'
    | 'PRAZO'
    | 'ESTUDO_DIRIGIDO'
    | 'RSS_ATRASADO'
    | 'FALTA_INJUSTIFICADA';
  titulo: string;
  descricao: string;
  turma_id?: string;
  turma_nome?: string;
  matricula_id?: string;
  aluno_nome?: string;
  prazo?: string;
  urgencia: 'CRITICA' | 'ALTA' | 'MEDIA';
  targetTab: NavTab;
  targetParam?: string;
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

