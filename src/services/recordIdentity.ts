import { CHAVE_PRIMARIA } from './tabelas';

/** Mantido para compatibilidade: chave primária real de cada aba. */
export const PRIMARY_KEYS: Record<string, string> = CHAVE_PRIMARIA as Record<string, string>;

/**
 * Identidade de um registro. Frequência e encontro são únicos por (matrícula|turma, data):
 * repetir a chamada ou remarcar a mesma aula atualiza a linha em vez de duplicar.
 */
export function recordIdentity(table: string, row: Record<string, any>): string {
  if (table === 'frequencias' && row.matricula_id && row.data_aula)
    return JSON.stringify([String(row.matricula_id), String(row.data_aula).slice(0, 10)]);
  if (table === 'encontros_turma' && row.turma_id && row.data)
    return JSON.stringify([String(row.turma_id), String(row.data).slice(0, 10)]);
  const key = PRIMARY_KEYS[table];
  const value = key && row[key];
  if (value === undefined || value === null || String(value).trim() === '')
    throw new Error(`Registro incompatível: chave ${key || table} ausente.`);
  return String(value).trim();
}
