/**
 * Registro único das abas da planilha usadas pelo app.
 * Toda leitura, cache e gravação parte desta lista (antes ela era repetida em três lugares).
 */
import type { DadosBase } from '../types';

/** Aba da planilha → campo em DadosBase. A ordem não importa. */
export const CAMPO_POR_TABELA = {
  periodos: 'periodos',
  disciplinas: 'disciplinas',
  turmas: 'turmas',
  horarios_turma: 'horarios',
  turmas_origem: 'turmasOrigem',
  alunos: 'alunos',
  matriculas: 'matriculas',
  criterios_avaliacao: 'criterios',
  orientacoes: 'orientacoes',
  configuracoes: 'configuracoes',
  marcos_academicos: 'marcos',
  pontos_acompanhamento: 'pontosAcompanhamento',
  frequencias: 'frequencias',
  registros_semanais: 'registrosSemanais',
  avaliacoes: 'avaliacoes',
  feedbacks: 'feedbacks',
  feedback_alunos: 'feedbacksLegados',
  ocorrencias: 'ocorrencias',
  regras_rss: 'regrasRss',
  calendario_rss: 'calendarioRss',
  status_rss_unidades: 'statusRssUnidades',
  situacao_atual_turmas: 'situacaoAtualTurmas',
  leituras_responsaveis: 'leiturasResponsaveis',
  grupos_pratica: 'gruposPratica',
  grupo_integrantes: 'grupoIntegrantes',
  entregas: 'entregas',
  encontros_turma: 'encontros',
  avaliacoes_completas: 'avaliacoesCompletas',
  preparacoes_aula: 'preparacoesAula',
  tarefas_professora: 'tarefas',
} as const satisfies Record<string, keyof DadosBase>;

export type TabelaBase = keyof typeof CAMPO_POR_TABELA;
export const TABELAS_LIDAS = Object.keys(CAMPO_POR_TABELA) as TabelaBase[];

/** Sem estas abas o app não sabe quem são as turmas e os estudantes. */
export const TABELAS_ESSENCIAIS: TabelaBase[] = ['periodos', 'disciplinas', 'turmas', 'alunos', 'matriculas'];

/** Abas mantidas pelo app: se faltarem, são criadas na primeira gravação e não contam como erro. */
export const COLUNAS_DAS_ABAS_DO_APP: Partial<Record<TabelaBase, string[]>> = {
  encontros_turma: [
    'encontro_id', 'turma_id', 'periodo_id', 'data', 'status', 'motivo_nao_realizado', 'observacao',
    'atualizado_em', 'fonte', 'hora_inicio', 'hora_fim', 'data_original', 'data_reagendada',
    'hora_reagendada', 'chamada_salva', 'total_presentes', 'total_faltas',
  ],
  avaliacoes_completas: [
    'avaliacao_id', 'matricula_id', 'aluno_id', 'turma_id', 'instrumento_id', 'tipo_instrumento',
    'nota_final', 'nota_maxima', 'status', 'notas_criterios_json', 'comentario_geral', 'pontos_fortes',
    'pontos_desenvolver', 'feedback_gerado', 'data_avaliacao', 'data_aprovacao', 'data_envio', 'atualizado_em',
  ],
  preparacoes_aula: [
    'preparacao_id', 'turma_id', 'periodo_id', 'data_aula', 'tipo', 'texto', 'status', 'criado_em',
    'atualizado_em', 'alvo_tipo', 'alvo_id', 'alvo_nome', 'ordem',
  ],
  tarefas_professora: [
    'tarefa_id', 'titulo', 'detalhe', 'categoria', 'prioridade', 'duracao_minutos', 'status', 'turma_id',
    'matricula_id', 'prazo', 'origem', 'criado_em', 'atualizado_em',
  ],
};

/** Colunas que o app pode acrescentar ao fim de abas já existentes (nunca renomeia nem apaga). */
export const COLUNAS_EXTRAS_PERMITIDAS: Partial<Record<TabelaBase, string[]>> = {
  ...COLUNAS_DAS_ABAS_DO_APP,
  frequencias: ['atraso', 'celular', 'observacao', 'conversa', 'saiu_cedo', 'participou', 'apresentacao'],
  leituras_responsaveis: ['status_realizacao', 'responsaveis_efetivos', 'motivo_substituicao'],
  matriculas: ['origem_id'],
};

/**
 * Abas em que o app grava. Abas geradas por fórmula (registros_semanais, status_rss_unidades,
 * situacao_atual_turmas, marcos_academicos) ficam fora: gravar nelas quebraria as fórmulas.
 */
export const TABELAS_GRAVAVEIS: TabelaBase[] = [
  'periodos', 'turmas', 'horarios_turma', 'turmas_origem', 'alunos', 'matriculas', 'orientacoes',
  'avaliacoes', 'criterios_avaliacao', 'feedbacks', 'ocorrencias', 'frequencias', 'pontos_acompanhamento',
  'entregas', 'leituras_responsaveis', 'encontros_turma', 'avaliacoes_completas', 'preparacoes_aula',
  'tarefas_professora',
];

/** Em abas com colunas calculadas por fórmula, só estes campos podem ser alterados. */
export const CAMPOS_EDITAVEIS: Partial<Record<TabelaBase, string[]>> = {
  leituras_responsaveis: ['status_realizacao', 'responsaveis_efetivos', 'motivo_substituicao'],
  entregas: ['status', 'data_envio'],
};

/** Abas que o app só atualiza; nunca cria linhas novas nelas. */
export const TABELAS_SOMENTE_ATUALIZACAO: TabelaBase[] = ['leituras_responsaveis'];

/** Chave primária real de cada aba (nome da coluna na planilha). */
export const CHAVE_PRIMARIA: Partial<Record<TabelaBase, string>> = {
  periodos: 'periodo_id', disciplinas: 'disciplina_id', turmas: 'turma_id',
  horarios_turma: 'horario_id', turmas_origem: 'origem_id', alunos: 'aluno_id',
  matriculas: 'matricula_id', orientacoes: 'orientacao_id', registros_semanais: 'registro_id',
  avaliacoes: 'avaliacao_id', feedback_alunos: 'feedback_id', feedbacks: 'feedback_id',
  criterios_avaliacao: 'criterio_id', ocorrencias: 'ocorrencia_id', configuracoes: 'chave',
  frequencias: 'frequencia_id', pontos_acompanhamento: 'ponto_id', marcos_academicos: 'marco_id',
  entregas: 'entrega_id', grupos_pratica: 'grupo_id', grupo_integrantes: 'grupo_integrante_id',
  leituras_responsaveis: 'leitura_agenda_id', encontros_turma: 'encontro_id',
  avaliacoes_completas: 'avaliacao_id', preparacoes_aula: 'preparacao_id', tarefas_professora: 'tarefa_id',
};

export function dadosVazios(): DadosBase {
  const dados = {} as Record<string, unknown[]>;
  for (const campo of Object.values(CAMPO_POR_TABELA)) dados[campo] = [];
  return dados as unknown as DadosBase;
}

/** Converte o mapa aba → linhas no objeto usado pelo app. */
export function montarDadosBase(mapa: Record<string, any[] | undefined>): DadosBase {
  const dados = dadosVazios() as unknown as Record<string, any[]>;
  for (const [tabela, campo] of Object.entries(CAMPO_POR_TABELA)) {
    dados[campo] = Array.isArray(mapa[tabela]) ? mapa[tabela]! : [];
  }
  return dados as unknown as DadosBase;
}
