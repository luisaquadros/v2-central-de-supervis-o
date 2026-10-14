import {notaValidaParaEncerramento} from "../services/encerramentoPeriodoService";
import { dataAcademica } from "../services/valoresAcademicos";
type Row = Record<string, unknown>;
export type CarregarRegistros = (tabela: string) => Promise<Row[]>;
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("pt-BR");
export class IntegridadeSemestreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Executada dentro da fila serial do coordenador, sobre dados oficiais. */
export async function conferirIntegridadeSemestre(
  tabela: string,
  tipo: string,
  registro: Row,
  remoto: Row | null,
  linhas: Row[],
  ler: CarregarRegistros,
) {
  const cache = new Map<string, Row[]>();
  const dados = async (t: string) => {
    if (!cache.has(t)) cache.set(t, await ler(t));
    return cache.get(t)!;
  };
  const buscar = async (t: string, k: string, id: unknown) =>
    (await dados(t)).find((r) => String(r[k]) === String(id));
  const periodo = async (
    r: Row,
    t = tabela,
    depth = 0,
  ): Promise<string | undefined> => {
    if (depth > 3) return undefined;
    if (r.matricula_id && t !== "matriculas") {
      const m = await buscar("matriculas", "matricula_id", r.matricula_id);
      if (m) return periodo(m, "matriculas", depth + 1);
    }
    if (r.turma_id && t !== "turmas") {
      const turma = await buscar("turmas", "turma_id", r.turma_id);
      if (turma) return periodo(turma, "turmas", depth + 1);
    }
    if (r.grupo_id && t !== "grupos_pratica") {
      const g = await buscar("grupos_pratica", "grupo_id", r.grupo_id);
      if (g) return periodo(g, "grupos_pratica", depth + 1);
    }
    if (r.criterio_id && t !== "criterios_avaliacao") {
      const c = await buscar(
        "criterios_avaliacao",
        "criterio_id",
        r.criterio_id,
      );
      if (c) return periodo(c, "criterios_avaliacao", depth + 1);
    }
    return r.periodo_id ? String(r.periodo_id) : undefined;
  };
  for (const alvo of [remoto, { ...(remoto || {}), ...registro }]) {
    if (!alvo) continue;
    const p = await periodo(alvo);
    if (
      p &&
      (await buscar("periodos", "periodo_id", p))?.status === "ARQUIVADO"
    )
      throw new IntegridadeSemestreError(
        "PERIODO_ARQUIVADO",
        "Este período é histórico. Edição comum bloqueada; retificação requer fluxo formal autorizado.",
      );
  }
  if (tipo === "DELETE") {
    if (["frequencias", "avaliacoes", "avaliacoes_completas"].includes(tabela))
      throw new IntegridadeSemestreError(
        "EXCLUSAO_ACADEMICA_PROTEGIDA",
        "Registros de frequência e avaliação são preservados. Correção exige fluxo formal auditado.",
      );
    const filhos: Record<string, [string, string][]> = {
      periodos: [["turmas", "periodo_id"]],
      disciplinas: [["turmas", "disciplina_id"]],
      alunos: [["matriculas", "aluno_id"]],
      turmas: [
        ["matriculas", "turma_id"],
        ["grupos_pratica", "turma_id"],
      ],
      matriculas: [
        ["frequencias", "matricula_id"],
        ["avaliacoes", "matricula_id"],
        ["grupo_integrantes", "matricula_id"],
      ],
      criterios_avaliacao: [["avaliacoes", "criterio_id"]],
      grupos_pratica: [["grupo_integrantes", "grupo_id"]],
    };
    const chave: Record<string, string> = {
      periodos: "periodo_id",
      disciplinas: "disciplina_id",
      alunos: "aluno_id",
      turmas: "turma_id",
      matriculas: "matricula_id",
      criterios_avaliacao: "criterio_id",
      grupos_pratica: "grupo_id",
    };
    for (const [filho, campo] of filhos[tabela] || [])
      if (
        (await dados(filho)).some((r) => r[campo] === registro[chave[tabela]])
      )
        throw new IntegridadeSemestreError(
          "REFERENCIA_EXISTENTE",
          "O registro tem vínculos acadêmicos. Preserve-o e utilize arquivamento.",
        );
    return;
  }
  const novo = { ...(remoto || {}), ...registro };
  if (tabela === 'avaliacao_rascunhos') {
    const coletivo = novo.escopo === 'COLETIVA';
    const alvo = coletivo ? await buscar('grupos_pratica','grupo_id',novo.grupo_id) : await buscar('matriculas','matricula_id',novo.matricula_id);
    const criterio = await buscar('criterios_avaliacao','criterio_id',novo.criterio_id);
    if (!alvo || String(alvo.turma_id) !== String(novo.turma_id) ||
      (coletivo && String(novo.matricula_id) !== `GRUPO:${novo.grupo_id}`) ||
      (criterio?.turma_id && String(criterio.turma_id) !== String(novo.turma_id))) {
      throw new IntegridadeSemestreError('VINCULO_INCONSISTENTE','Confira o vínculo do rascunho com matrícula/grupo, turma e critério.');
    }
  }
  if (["frequencias", "encontros_turma"].includes(tabela)) {
    const pId = await periodo(novo),
      p = pId ? await buscar("periodos", "periodo_id", pId) : undefined;
    const data = dataAcademica(novo.data_aula ?? novo.data),
      inicio = dataAcademica(p?.data_inicio),
      fim = dataAcademica(p?.data_fim);
    if (data && inicio && fim && (data < inicio || data > fim))
      throw new IntegridadeSemestreError(
        "DATA_FORA_DO_PERIODO",
        "Confira a data do encontro e a vigência do período. Não é permitido registrar frequência em outro semestre.",
      );
  }

  if (
    tabela === "encontros_turma" &&
    remoto &&
    String(remoto.chamada_salva).toUpperCase() === "TRUE" &&
    ["status", "data", "turma_id", "chamada_salva"].some(
      (k) =>
        registro[k] != null &&
        (k === "data"
          ? dataAcademica(registro[k]) !== dataAcademica(remoto[k])
          : String(registro[k]).toUpperCase() !==
            String(remoto[k]).toUpperCase()),
    )
  )
    throw new IntegridadeSemestreError(
      "CHAMADA_ENCERRADA",
      "Encontro com chamada confirmada: cancelamento e alteração exigem retificação formal.",
    );

  if (tabela === "periodos") {
    if (
      !novo.nome ||
      !novo.data_inicio ||
      !novo.data_fim ||
      String(novo.data_inicio) > String(novo.data_fim)
    )
      throw new IntegridadeSemestreError(
        "PERIODO_INVALIDO",
        "Confira identificação e datas do semestre.",
      );
    if (
      linhas.some(
        (r) =>
          r.periodo_id !== novo.periodo_id && norm(r.nome) === norm(novo.nome),
      )
    )
      throw new IntegridadeSemestreError(
        "PERIODO_DUPLICADO",
        "Já existe um semestre com esta identificação.",
      );
  }
  if (tabela === "grupo_integrantes") {
    const g = await buscar("grupos_pratica", "grupo_id", novo.grupo_id),
      m = await buscar("matriculas", "matricula_id", novo.matricula_id);
    if (g && m && g.turma_id !== m.turma_id)
      throw new IntegridadeSemestreError(
        "GRUPO_FORA_DA_TURMA",
        "O grupo e a matrícula devem pertencer à mesma turma.",
      );
    if (
      String(novo.status).toUpperCase() === "ATIVO" &&
      !novo.data_fim &&
      linhas.some(
        (r) =>
          r.grupo_integrante_id !== novo.grupo_integrante_id &&
          r.grupo_id === novo.grupo_id &&
          r.matricula_id === novo.matricula_id &&
          String(r.status).toUpperCase() === "ATIVO" &&
          !r.data_fim,
      )
    )
      throw new IntegridadeSemestreError(
        "INTEGRANTE_DUPLICADO",
        "A matrícula já tem vínculo ativo com este grupo.",
      );
  }
  if (
    tabela === "frequencias" &&
    remoto &&
    ["status", "atraso", "celular", "justificativa", "observacao"].some(
      (k) => registro[k] != null && String(registro[k]) !== String(remoto[k]),
    )
  ) {
    const m = await buscar("matriculas", "matricula_id", remoto.matricula_id),
      data = dataAcademica(remoto.data_aula);
    if (
      m &&
      data &&
      (await dados("encontros_turma")).some(
        (e) =>
          e.turma_id === m.turma_id &&
          dataAcademica(e.data) === data &&
          String(e.chamada_salva).toUpperCase() === "TRUE",
      )
    )
      throw new IntegridadeSemestreError(
        "CHAMADA_ENCERRADA",
        "Chamada confirmada: alteração comum bloqueada. Retificação exige fluxo formal com justificativa e auditoria.",
      );
  }
  if (
    tabela === "avaliacoes" &&
    tipo === "INSERT" &&
    linhas.some(
      (r) =>
        r.avaliacao_id !== novo.avaliacao_id &&
        r.matricula_id === novo.matricula_id &&
        r.criterio_id === novo.criterio_id,
    )
  )
    throw new IntegridadeSemestreError(
      "AVALIACAO_DUPLICADA",
      "Já existe avaliação deste critério para a matrícula. Atualize e revise a versão existente.",
    );
  if (
    tabela === "avaliacoes_completas" &&
    tipo === "INSERT" &&
    linhas.some(
      (r) =>
        r.avaliacao_id !== novo.avaliacao_id &&
        r.matricula_id === novo.matricula_id &&
        r.instrumento_id === novo.instrumento_id,
    )
  )
    throw new IntegridadeSemestreError(
      "AVALIACAO_DUPLICADA",
      "Já existe avaliação deste instrumento para a matrícula. Atualize e revise a versão existente.",
    );
  if (tabela === "avaliacoes" && novo.matricula_id && novo.criterio_id) {
    const m = await buscar("matriculas", "matricula_id", novo.matricula_id),
      c = await buscar("criterios_avaliacao", "criterio_id", novo.criterio_id);
    const t = m ? await buscar("turmas", "turma_id", m.turma_id) : undefined;
    if (
      c &&
      m &&
      ((c.turma_id && c.turma_id !== m.turma_id) ||
        (c.periodo_id && c.periodo_id !== m.periodo_id) ||
        (c.disciplina_id && t && c.disciplina_id !== t.disciplina_id))
    )
      throw new IntegridadeSemestreError(
        "CRITERIO_FORA_DA_TURMA",
        "A avaliação deve usar a rubrica da matrícula selecionada.",
      );
  }
  if (
    tabela === "criterios_avaliacao" &&
    remoto &&
    Object.keys(registro).some(
      (k) => k !== "criterio_id" && norm(registro[k]) !== norm(remoto[k]),
    )
  ) {
    if (
      (await dados("avaliacoes")).some(
        (a) =>
          a.criterio_id === remoto.criterio_id &&
          a.nota != null &&
          String(a.nota).trim() !== "",
      )
    )
      throw new IntegridadeSemestreError(
        "CRITERIO_EM_USO",
        "Critério com avaliações existentes exige nova versão; a versão atual permanece preservada.",
      );
  }
  if (
    tabela === "periodos" &&
    novo.status === "ARQUIVADO" &&
    remoto?.status !== "ARQUIVADO"
  ) {
    const ts = (await dados("turmas")).filter(
        (t) => t.periodo_id === novo.periodo_id,
      ),
      ids = new Set(ts.map((t) => t.turma_id));
    const ms = (await dados("matriculas")).filter((m) => ids.has(m.turma_id)),
      cs = await dados("criterios_avaliacao"),
      av = await dados("avaliacoes");
    if (ms.some((m) => m.status === "PENDENTE"))
      throw new IntegridadeSemestreError(
        "PERIODO_COM_PENDENCIAS",
        "Há inscrições pendentes neste período.",
      );
    for (const m of ms.filter((m) => m.status === "MATRICULADO")) {
      const t = ts.find((t) => t.turma_id === m.turma_id)!;
      const aplicaveis = cs.filter(
        (c) =>
          c.ativo !== false &&
          String(c.ativo).toUpperCase() !== "FALSE" &&
          (!c.periodo_id || c.periodo_id === novo.periodo_id) &&
          (!c.turma_id || c.turma_id === m.turma_id) &&
          (!c.disciplina_id || c.disciplina_id === t.disciplina_id),
      );
      if (
        !aplicaveis.length ||
        aplicaveis.some(
          (c) =>
            c.status_validacao === "A_CONFERIR" ||
            !av.some(
              (a) =>
                a.matricula_id === m.matricula_id &&
                a.criterio_id === c.criterio_id &&
                notaValidaParaEncerramento(a.nota,c.nota_maxima),
            ),
        )
      )
        throw new IntegridadeSemestreError(
          "PERIODO_COM_PENDENCIAS",
          "Há rubricas ou avaliações pendentes neste período.",
        );
    }
  }
  if (
    tabela === "alunos" &&
    norm(novo.identificador_academico) &&
    linhas.some(
      (r) =>
        r.aluno_id !== novo.aluno_id &&
        norm(r.identificador_academico) === norm(novo.identificador_academico),
    )
  )
    throw new IntegridadeSemestreError(
      "ALUNO_DUPLICADO",
      "Identificador acadêmico já cadastrado. Vincule o aluno existente.",
    );
  if (tabela === "matriculas") {
    if (
      remoto &&
      ["aluno_id", "turma_id", "periodo_id"].some(
        (k) => registro[k] != null && String(registro[k]) !== String(remoto[k]),
      )
    )
      throw new IntegridadeSemestreError(
        "MATRICULA_IDENTIDADE_IMUTAVEL",
        "Os vínculos de uma matrícula com histórico não são transferidos. Crie uma matrícula independente.",
      );
    const turma = await buscar("turmas", "turma_id", novo.turma_id);
    if (!turma || String(turma.periodo_id) !== String(novo.periodo_id))
      throw new IntegridadeSemestreError(
        "PERIODO_INCOMPATIVEL",
        "A matrícula deve pertencer ao período da turma.",
      );
    if (
      linhas.some(
        (r) =>
          r.matricula_id !== novo.matricula_id &&
          r.aluno_id === novo.aluno_id &&
          r.turma_id === novo.turma_id,
      )
    )
      throw new IntegridadeSemestreError(
        "MATRICULA_DUPLICADA",
        "Este aluno já possui matrícula nesta turma.",
      );
  }
}
