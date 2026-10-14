import type { Periodo, Turma, CriterioAvaliacao, HorarioTurma } from "../types";

export function validarNovoPeriodo(
  nome: string,
  inicio: string,
  fim: string,
  periodos: Periodo[],
  inicioAulas?: string,
) {
  const data = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (!nome.trim() || nome.trim().length > 80)
    throw new Error("Informe uma identificação para o semestre.");
  if (
    periodos.some(
      (p) =>
        p.nome.trim().toLocaleLowerCase("pt-BR") ===
        nome.trim().toLocaleLowerCase("pt-BR"),
    )
  )
    throw new Error("Já existe um período com esta identificação.");
  if (!data(inicio) || !data(fim) || inicio > fim)
    throw new Error("Informe datas válidas, com término após o início.");
  if (
    inicioAulas &&
    (!data(inicioAulas) || inicioAulas < inicio || inicioAulas > fim)
  )
    throw new Error("O início das aulas deve estar dentro do semestre.");
}

/** Planeja somente estrutura; jamais aceita coleções de dados de estudantes. */
export function planejarPeriodo(
  input: {
    nome: string;
    inicio: string;
    fim: string;
    inicioAulas?: string;
    modelo?: string;
  },
  base: {
    periodos: Periodo[];
    turmas: Turma[];
    criterios: CriterioAvaliacao[];
    horarios: HorarioTurma[];
  },
  id: () => string = () => crypto.randomUUID(),
) {
  validarNovoPeriodo(
    input.nome,
    input.inicio,
    input.fim,
    base.periodos,
    input.inicioAulas,
  );
  const periodo: Periodo = {
    periodo_id: id(),
    nome: input.nome.trim(),
    data_inicio: input.inicio,
    data_fim: input.fim,
    status: "PLANEJADO",
  };
  const originais = input.modelo
    ? base.turmas.filter((t) => t.periodo_id === input.modelo)
    : [];
  const vinculos = new Map(originais.map((t) => [t.turma_id, id()]));
  const turmas = originais.map((t) => ({
    ...t,
    turma_id: vinculos.get(t.turma_id)!,
    periodo_id: periodo.periodo_id,
    status: "ATIVO" as const,
  }));
  const disciplinas = new Set(originais.map((t) => t.disciplina_id));
  const criterios = input.modelo
    ? base.criterios
        .filter(
          (c) =>
            c.periodo_id === input.modelo ||
            (!!c.turma_id && vinculos.has(c.turma_id)) ||
            (!c.periodo_id &&
              !c.turma_id &&
              !!c.disciplina_id &&
              disciplinas.has(c.disciplina_id)),
        )
        .filter((c) => !c.turma_id || vinculos.has(c.turma_id))
        .map((c) => ({
          ...c,
          criterio_id: id(),
          periodo_id: periodo.periodo_id,
          turma_id: c.turma_id ? vinculos.get(c.turma_id) : c.turma_id,
          status_validacao: "A_CONFERIR",
        }))
    : [];
  // Dias e horários são modelos; vigência é explicitamente a do novo semestre.
  const horarios = base.horarios
    .filter((h) => vinculos.has(h.turma_id))
    .map((h) => ({
      horario_id: id(),
      turma_id: vinculos.get(h.turma_id)!,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      ativo: h.ativo,
      data_inicio: input.inicioAulas || input.inicio,
      data_fim: input.fim,
    }));
  const marcos = input.inicioAulas
    ? [
        {
          marco_id: id(),
          periodo_id: periodo.periodo_id,
          nome: "Início das aulas",
          codigo_marco: "INICIO_AULAS",
          tipo: "OUTRO" as const,
          data_prazo: input.inicioAulas,
          status: "PLANEJADO" as const,
          origem: "CADASTRO_PERIODO",
          escopo_marco: "DISCIPLINA",
        },
      ]
    : [];
  return { periodo, turmas, criterios, horarios, marcos };
}
