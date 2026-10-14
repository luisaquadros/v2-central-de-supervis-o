import type { Matricula } from "../types";

/** Identificadores legados só são exibidos quando há uma única matrícula possível. */
export function registroDaMatricula(
  registro: {
    matricula_id?: string;
    aluno_id?: string;
    turma_id?: string;
    periodo_id?: string;
  },
  matricula: Matricula,
  matriculas: Matricula[],
  identificadorAcademico?: string,
): boolean {
  if (registro.matricula_id === matricula.matricula_id) return true;
  // Uma matrícula explícita de outra turma sempre prevalece sobre aluno_id legado.
  if (
    registro.matricula_id &&
    matriculas.some((m) => m.matricula_id === registro.matricula_id)
  )
    return false;
  if (
    registro.aluno_id !== matricula.aluno_id &&
    (!identificadorAcademico ||
      registro.matricula_id !== identificadorAcademico)
  )
    return false;
  const candidatas = matriculas.filter(
    (m) =>
      m.aluno_id === matricula.aluno_id &&
      (!registro.turma_id || m.turma_id === registro.turma_id) &&
      (!registro.periodo_id || m.periodo_id === registro.periodo_id),
  );
  return (
    candidatas.length === 1 &&
    candidatas[0].matricula_id === matricula.matricula_id
  );
}
