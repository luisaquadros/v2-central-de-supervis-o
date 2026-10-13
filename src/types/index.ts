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
  identificador_academico: string; // Ex: 'RA202601' (vazio na base atual)
  status: 'ATIVO' | 'TRANCADO' | 'CONCLUIDO' | string;
  email?: string;
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
  aluno_id?: string; // Compatibilidade de leitura com identificadores legados; prioridade sempre à matrícula.
  registro_id: string;
  matricula_id: string;
  semana: number; // 1 a 12 (configurável)
  status: 'ENTREGUE' | 'FALTANTE' | 'PENDENTE_REVISAO';
  data_entrega: string; // YYYY-MM-DD ou vazio
  observacao: string;
}

export interface Avaliacao {
  aluno_id?: string; // Compatibilidade de leitura com identificadores legados; prioridade sempre à matrícula.
  avaliacao_id: string;
  matricula_id: string;
  criterio_id: string;
  nota: number;
  observacao: string;
  /** Nota como foi dada (ex.: prova "7,5" de 0 a 10), antes da conversão para o peso do critério. */
  valor_original?: string;
  origem?: string;
}

export interface FeedbackAluno {
  aluno_id?: string; // Compatibilidade de leitura com identificadores legados; prioridade sempre à matrícula.
  feedback_id: string;
  /** Vazio quando o registro é sobre a turma inteira. */
  matricula_id: string;
  data_hora: string;
  texto: string;
  turma_id?: string;
  categoria?: string;
  incluir_na_devolutiva?: boolean | string;
  /** Data como estava escrita na planilha, quando não era uma data simples. */
  data_texto?: string;
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
  leitura_agenda_id?: string;
  titulo?: string;
  tipo?: 'ESTUDO_DIRIGIDO' | 'LEITURA_RECOMENDADA' | string;
  responsaveis_texto?: string;
  responsavel_tipo?: 'ALUNO' | 'ALUNOS' | 'SEM_RESPONSAVEL' | 'TURMA_TODA' | 'MONITORA' | string;
  status_temporal?: string;
  turma_id?: string;
  data?: string;
  tema?: string;
  artigo_leitura?: string;
  referencia_link?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  aluno_id?: string;
  responsaveis_previstos?: string[]; // IDs de matrícula previstos
  status_realizacao?: 'PLANEJADO' | 'REALIZADO' | 'PARCIAL' | 'NAO_REALIZADO' | 'SUBSTITUICAO' | '';
  responsaveis_efetivos?: string[]; // IDs de matrícula que apresentaram
  motivo_substituicao?: string;
  observacao?: string;
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

export type SituacaoEntrega = 'ENTREGUE' | 'A_CONFERIR' | 'PENDENTE' | 'NAO_SE_APLICA';

export interface Entrega {
  entrega_id?: string;
  periodo_id?: string;
  turma_id?: string;
  matricula_id?: string;
  tipo_documento?: string;
  tipo_entrega?: string;
  /** Texto original da planilha (ex.: "A conferir"). */
  status?: string;
  status_entrega?: string;
  /** Situação padronizada a partir do status. */
  situacao?: SituacaoEntrega;
  prazo?: string;
  data_entrega?: string;
  observacao?: string;
  [key: string]: any;
}

export interface Feedback {
  feedback_id: string;
  periodo_id?: string;
  turma_id?: string;
  escopo?: string;
  matricula_id?: string;
  grupo_id?: string;
  aluno_id?: string;
  data?: string;
  data_hora?: string;
  categoria?: string;
  texto?: string;
  incluir_na_devolutiva?: boolean | string;
  criado_em?: string;
  atualizado_em?: string;
  [key: string]: any;
}

export interface Ocorrencia {
  aluno_id?: string; // Compatibilidade de leitura com identificadores legados; prioridade sempre à matrícula.
  ocorrencia_id: string;
  matricula_id: string;
  data_hora: string;
  tipo: 'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'CONVERSA_PARALELA' | 'SAIDA_ANTECIPADA' | 'OUTRO';
  observacao: string;
  /** Data como estava escrita na planilha, quando não era uma data simples ("29/09 e 05/10/2026"). */
  data_texto?: string;
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
  [key: string]: any;
  aluno_id?: string; // Compatibilidade de leitura com identificadores legados; prioridade sempre à matrícula.
  frequencia_id: string;
  matricula_id: string;
  data_aula: string; // YYYY-MM-DD
  status: 'PRESENTE' | 'FALTA_SEM_JUSTIFICATIVA' | 'FALTA_JUSTIFICADA' | 'JUSTIFICATIVA_PENDENTE';
  justificativa: string;
  origem_id: string; // FK -> TurmaOrigem
  atraso?: boolean;
  celular?: boolean;
  conversa?: boolean;
  saiu_cedo?: boolean;
  participou?: boolean;
  /** Estudo dirigido apresentado nesta aula e a impressão da professora. */
  apresentacao?: '' | 'APRESENTOU' | 'OTIMA' | 'MEDIA' | 'MINIMA';
  observacao?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface HorarioTurma {
  horario_id: string;
  turma_id: string;
  /** 0=Domingo … 6=Sábado (a planilha usa "TERCA", "QUINTA"…, convertido na leitura). */
  dia_semana: number | null;
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
  aluno_id?: string; // Compatibilidade de leitura com identificadores legados; prioridade sempre à matrícula.
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
  [key: string]: any;
  marco_id: string;
  periodo_id: string;
  disciplina_id?: string;
  turma_id?: string;
  nome: string; // Ex: 'Final dos atendimentos'
  tipo: string;
  data_prazo: string;
  /** Calculado por fórmula na planilha (CONCLUIDO quando a data passa). */
  status: 'PENDENTE' | 'CONCLUIDO' | 'HOJE' | string;
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

// -----------------------------------------------------------------------------
// GESTÃO OPERACIONAL DE ENCONTROS, AULAS NÃO REALIZADAS E REAGENDAMENTOS
// -----------------------------------------------------------------------------
export type StatusEncontro = 'PREVISTO' | 'REALIZADO' | 'NAO_REALIZADO' | 'REAGENDADO' | string;
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
  fonte?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ItemPendenciaOperacional {
  id: string;
  tipo:
    | 'CHAMADA'
    | 'JUSTIFICATIVA'
    | 'RISCO_FALTAS'
    | 'DOCUMENTO'
    | 'DOCUMENTO_CONFERIR'
    | 'ESTUDO_DIRIGIDO'
    | 'DEVOLUTIVA';
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
  /** Dados para resolver o item direto na lista. */
  dataAula?: string;
  frequencia_id?: string;
  entrega_ids?: string[];
  leitura_id?: string;
  avaliacao_id?: string;
  quantidade?: number;
}

// Navegação do aplicativo
export type NavTab =
  | 'hoje'
  | 'turmas'
  | 'alunos'
  | 'pendencias'
  | 'avaliacao'
  | 'calendario'
  | 'ajustes';

// -----------------------------------------------------------------------------
// TAREFAS DA PROFESSORA E CASOS PARA DISCUTIR (persistidos na planilha)
// -----------------------------------------------------------------------------

/** Lembrete/tarefa curta da professora (aba tarefas_professora). */
export interface Tarefa {
  id: string;
  tarefa_id?: string;
  titulo: string;
  detalhe?: string;
  categoria?: string;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  duracao_minutos: number;
  status: 'PENDENTE' | 'CONCLUIDO';
  turma_id?: string;
  matricula_id?: string;
  prazo?: string;
  origem?: string;
  criado_em: string;
  atualizado_em?: string;
}

/** Linha da aba preparacoes_aula (casos para discutir e anotações de preparo). */
export interface PreparacaoAula {
  preparacao_id: string;
  turma_id: string;
  periodo_id?: string;
  data_aula?: string;
  tipo: 'CASO' | 'NOTA' | string;
  texto: string;
  status: 'AGUARDANDO' | 'DISCUTIDO' | string;
  alvo_tipo?: 'ALUNO' | 'GRUPO' | 'TURMA' | string;
  alvo_id?: string;
  alvo_nome?: string;
  ordem?: number | string;
  criado_em?: string;
  atualizado_em?: string;
}

/** Tudo o que o app lê da planilha (uma propriedade por aba). */
export interface DadosBase {
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
  registrosSemanais: RegistroSemanal[];
  avaliacoes: Avaliacao[];
  feedbacks: Feedback[];
  feedbacksLegados: FeedbackAluno[];
  ocorrencias: Ocorrencia[];
  regrasRss: RegraRss[];
  calendarioRss: CalendarioRss[];
  statusRssUnidades: StatusRssUnidade[];
  situacaoAtualTurmas: SituacaoAtualTurma[];
  leiturasResponsaveis: LeituraResponsavel[];
  gruposPratica: GrupoPratica[];
  grupoIntegrantes: GrupoIntegrante[];
  entregas: Entrega[];
  encontros: EncontroTurma[];
  avaliacoesCompletas: AvaliacaoCompleta[];
  preparacoesAula: PreparacaoAula[];
  tarefas: Tarefa[];
}
