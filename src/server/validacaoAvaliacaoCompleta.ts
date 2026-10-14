import { numeroAcademico } from "../services/valoresAcademicos";
import {
  IntegridadeSemestreError,
  type CarregarRegistros,
} from "./integridadeSemestre";
type Row = Record<string, unknown>;
/** Confere evidências/limites da rubrica existente; nunca grava nem corrige notas automaticamente. */
export async function validarAvaliacaoCompleta(
  novo: Row,
  ler: CarregarRegistros,
) {
  const dados = novo.notas_criterios ?? novo.notas_criterios_json;
  let notas: unknown = [];
  try {
    notas = typeof dados === "string" ? (dados.trim()?JSON.parse(dados):[]) : (dados ?? []);
  } catch {
    throw new IntegridadeSemestreError(
      "RUBRICA_INVALIDA",
      "Notas dos critérios não têm estrutura válida.",
    );
  }
  if (!Array.isArray(notas) || notas.length > 256)
    throw new IntegridadeSemestreError(
      "RUBRICA_INVALIDA",
      "Lista de critérios inválida.",
    );
  const m = (await ler("matriculas")).find(
    (m) => m.matricula_id === novo.matricula_id,
  );
  if (!m) {
    if (novo.status === "RASCUNHO" || novo.status == null) return;
    throw new IntegridadeSemestreError(
      "MATRICULA_INDETERMINADA",
      "Matrícula não identificada; conclusão de avaliação bloqueada.",
    );
  }
  if (novo.turma_id && novo.turma_id !== m.turma_id)
    throw new IntegridadeSemestreError(
      "CRITERIO_FORA_DA_TURMA",
      "A avaliação e a matrícula devem pertencer à mesma turma.",
    );
  const turma = (await ler("turmas")).find((t) => t.turma_id === m.turma_id);
  const criterios = (await ler("criterios_avaliacao")).filter(
    (c) =>
      c.ativo !== false &&
      String(c.ativo).toUpperCase() !== "FALSE" &&
      (!c.periodo_id || c.periodo_id === m.periodo_id) &&
      (!c.turma_id || c.turma_id === m.turma_id) &&
      (!c.disciplina_id || !turma || c.disciplina_id === turma.disciplina_id),
  );
  const oficial = novo.status !== undefined && novo.status !== "RASCUNHO";
  if (
    oficial &&
    (!criterios.length ||
      criterios.some((c) => c.status_validacao === "A_CONFERIR"))
  )
    throw new IntegridadeSemestreError(
      "RUBRICA_NAO_CONFIRMADA",
      "Conferência da rubrica necessária antes de concluir a avaliação.",
    );
  const vistos = new Set<string>();
  let soma = 0;
  for (const item of notas) {
    if (!item || typeof item !== "object")
      throw new IntegridadeSemestreError(
        "RUBRICA_INVALIDA",
        "Critério inválido.",
      );
    const n = item as Row,
      id = String(n.criterio_id || ""),
      c = criterios.find((c) => c.criterio_id === id);
    if (!c || vistos.has(id))
      throw new IntegridadeSemestreError(
        "CRITERIO_FORA_DA_TURMA",
        "Critério repetido, inexistente ou de outra turma.",
      );
    vistos.add(id);
    const nota = numeroAcademico(n.nota),
      max = numeroAcademico(c.nota_maxima);
    if (nota == null || max == null || nota < 0 || nota > max)
      throw new IntegridadeSemestreError(
        "INVALID_GRADE",
        "Nota incompatível com o critério oficial.",
      );
    soma += nota;
  }
  if (oficial && criterios.some((c) => !vistos.has(String(c.criterio_id))))
    throw new IntegridadeSemestreError(
      "RUBRICA_INCOMPLETA",
      "Há critérios sem avaliação; mantenha como rascunho.",
    );
  // A interface atual usa soma dos pontos dos critérios. Verificação desta mesma relação,
  // sem introduzir ponderação, novas rubricas ou recalcular dados persistidos.
  const total = numeroAcademico(novo.nota_final);
  if (oficial && total == null)
    throw new IntegridadeSemestreError(
      "TOTAL_AUSENTE",
      "Informe a nota total ou mantenha como rascunho.",
    );
  if (notas.length && total != null && Math.abs(total - soma) > 0.000001)
    throw new IntegridadeSemestreError(
      "TOTAL_INCONSISTENTE",
      "O total informado diverge dos pontos dos critérios.",
    );
}
