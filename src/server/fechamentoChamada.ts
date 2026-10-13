import { matriculaParticipaDaChamada } from "../services/aulaParticipants";
import { temSupervisaoHorarioAlternativo } from "../services/condicoesMatricula";
import { dataAcademica } from "../services/valoresAcademicos";
import { interpretarFrequenciaOficial } from "../services/normalizacaoAcademica";

export function conferirFechamento(
  turma: string,
  data: string,
  matriculas: Record<string, unknown>[],
  frequencias: Record<string, unknown>[],
) {
  const elegiveis = matriculas.filter(
    (m) => m.turma_id === turma && matriculaParticipaDaChamada(m.status),
  );
  const registros = frequencias.filter(
    (f) => dataAcademica(f.data_aula) === dataAcademica(data),
  );
  const obrigatorias = elegiveis.filter(
    (m) => !temSupervisaoHorarioAlternativo(m),
  );
  if (
    !elegiveis.length ||
    obrigatorias.some(
      (m) =>
        registros.filter((f) => f.matricula_id === m.matricula_id).length !== 1,
    )
  )
    throw new Error(
      "Chamada incompleta na planilha oficial. O encontro permanece aberto.",
    );
  const daTurma = registros.filter((f) =>
    elegiveis.some((m) => m.matricula_id === f.matricula_id),
  );
  if (new Set(daTurma.map((f) => f.matricula_id)).size !== daTurma.length)
    throw new Error("Frequências duplicadas. Confira antes de encerrar.");
  if (
    daTurma.some(
      (f) =>
        interpretarFrequenciaOficial(f.status).status === "NAO_IDENTIFICADO",
    )
  )
    throw new Error("Frequência não identificada. Confira antes de encerrar.");
  return {
    presentes: daTurma.filter(
      (f) => interpretarFrequenciaOficial(f.status).status === "PRESENTE",
    ).length,
    faltas: daTurma.filter(
      (f) => interpretarFrequenciaOficial(f.status).status !== "PRESENTE",
    ).length,
  };
}
