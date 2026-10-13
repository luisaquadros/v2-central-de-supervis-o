/** Explicit primary keys: never mistake a foreign key for the record identity. */
export const PRIMARY_KEYS: Record<string, string> = {
  periodos: 'periodo_id', disciplinas: 'disciplina_id', turmas: 'turma_id',
  horarios_turma: 'horario_id', turmas_origem: 'origem_id', alunos: 'aluno_id',
  matriculas: 'matricula_id', orientacoes: 'orientacao_id', registros_semanais: 'registro_id',
  documentos: 'documento_id', avaliacoes: 'avaliacao_id', feedback_alunos: 'feedback_id',
  criterios_avaliacao: 'criterio_id', ocorrencias: 'ocorrencia_id', configuracoes: 'chave',
  frequencias: 'frequencia_id', pontos_acompanhamento: 'ponto_id', marcos_academicos: 'marco_id',
  entregas: 'entrega_id', feedbacks: 'feedback_id', registros_supervisao: 'registro_id',
  grupos_pratica: 'grupo_id', grupo_integrantes: 'integrante_id',
  encontros_turma: 'encontro_id', preparacoes_aula: 'preparacao_id',
  avaliacoes_completas: 'avaliacao_id',
};
export function recordIdentity(table: string, row: Record<string, any>): string {
  if (table === 'frequencias' && row.matricula_id && row.data_aula)
    return JSON.stringify([String(row.matricula_id), String(row.data_aula)]);
  const key = PRIMARY_KEYS[table];
  const value = key && row[key];
  if (value === undefined || value === null || String(value).trim() === '')
    throw new Error(`Registro incompatível: chave ${key || table} ausente.`);
  return String(value).trim();
}
