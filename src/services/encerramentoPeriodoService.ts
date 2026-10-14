import type {
  Periodo,
  Turma,
  Matricula,
  CriterioAvaliacao,
  Avaliacao,
  ItemPendenciaOperacional,
} from "../types";
/** Diagnóstico de completude; não calcula notas, faltas ou abonos. */
export function revisarEncerramento(
  periodo: Periodo,
  base: {
    turmas: Turma[];
    matriculas: Matricula[];
    criterios: CriterioAvaliacao[];
    avaliacoes: Avaliacao[];
    pendencias: ItemPendenciaOperacional[];
    pendentesSync: number;
  },
) {
  const turmas = base.turmas.filter((t) => t.periodo_id === periodo.periodo_id);
  const ids = new Set(turmas.map((t) => t.turma_id));
  const mats = base.matriculas.filter(
    (m) =>
      m.periodo_id === periodo.periodo_id &&
      ids.has(m.turma_id) &&
      m.status === "MATRICULADO",
  );
  const inscricoes = base.matriculas.filter(
    (m) => ids.has(m.turma_id) && m.status === "PENDENTE",
  );
  const avisos = base.pendencias
    .filter((p) => p.turma_id && ids.has(p.turma_id))
    .map((p) => p.titulo);
  if (inscricoes.length)
    avisos.push(`${inscricoes.length} inscrição(ões) pendentes de decisão.`);
  for (const m of mats) {
    const turma = turmas.find((t) => t.turma_id === m.turma_id)!;
    const criterios = base.criterios.filter(
      (c) =>
        c.ativo !== false &&
        (!c.periodo_id || c.periodo_id === periodo.periodo_id) &&
        (!c.turma_id || c.turma_id === m.turma_id) &&
        (!c.disciplina_id || c.disciplina_id === turma.disciplina_id),
    );
    if (!criterios.length)
      avisos.push("Matrícula sem critérios de avaliação configurados.");
    if (
      criterios.some(
        (c) =>
          !base.avaliacoes.some(
            (a) =>
              a.matricula_id === m.matricula_id &&
              a.criterio_id === c.criterio_id &&
              a.nota != null &&
              String(a.nota).trim() !== "",
          ),
      )
    )
      avisos.push("Matrícula com critérios ainda não avaliados.");
  }
  if (base.pendentesSync)
    avisos.push(
      `${base.pendentesSync} operação(ões) aguardando sincronização.`,
    );
  return {
    turmas: turmas.length,
    matriculas: mats.length,
    pendencias: avisos,
    verificacoesManuais: [
      "Justificativas e reposições conforme regulamento",
      "Pareceres e conferência documental",
      "Homologação das notas pela professora",
    ],
  };
}
