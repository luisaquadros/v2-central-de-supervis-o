import { strict as assert } from "node:assert";
import { criarAmbiente } from "./ajudaAmbiente";
import { planejarPeriodo } from "../services/semestreService";
import { documentosDoEstudante } from "../services/monitoramentoDocumentosService";
import { prepararEncerramentoChamada } from "../services/chamadaService";
import type {
  Periodo,
  Turma,
  Matricula,
  MonitoramentoDocumento,
} from "../types";

let i = 0;
const id = () => `ficticio-${++i}`;
const antigo: Periodo = {
  periodo_id: "p-antigo",
  nome: "2026.2",
  data_inicio: "2026-08-01",
  data_fim: "2026-12-20",
  status: "ARQUIVADO",
};
const turmas = Array.from(
  { length: 3 },
  (_, j) =>
    ({
      turma_id: `t-ant-${j}`,
      periodo_id: antigo.periodo_id,
      disciplina_id: `d-${j}`,
      nome: `Turma fictícia ${j + 1}`,
      turno: "MATUTINO",
      status: "ATIVO",
    }) as Turma,
);
const criterios = turmas.flatMap((t) =>
  [0, 1].map((j) => ({
    criterio_id: `c-${t.turma_id}-${j}`,
    periodo_id: antigo.periodo_id,
    turma_id: t.turma_id,
    disciplina_id: t.disciplina_id,
    nome: `Critério ${j + 1}`,
    nota_maxima: 5,
    peso: 1,
    ativo: true,
    status_validacao: "CONFIRMADO",
  })),
);
const plano = planejarPeriodo(
  {
    nome: "2027.1",
    inicio: "2027-02-01",
    fim: "2027-06-30",
    modelo: antigo.periodo_id,
  },
  { periodos: [antigo], turmas, criterios, horarios: [] },
  id,
);
const cabC = [
  "criterio_id",
  "periodo_id",
  "disciplina_id",
  "turma_id",
  "nome",
  "nota_maxima",
  "peso",
  "ativo",
  "status_validacao",
];
const campos = (cab: string[], r: Record<string, unknown>) =>
  cab.map((k) => r[k] ?? "");
const amb = await criarAmbiente({
  env:{ACESSOS_JSON:JSON.stringify({monitoras:[{email:'monitora@exemplo.com',turmas:[plano.turmas[0].turma_id],operacoes:['CHAMADA','ENTREGAS','DOCUMENTOS_VER']}]})},
  abas: {
    periodos: [
      ["periodo_id", "nome", "data_inicio", "data_fim", "status"],
      [
        antigo.periodo_id,
        antigo.nome,
        antigo.data_inicio,
        antigo.data_fim,
        antigo.status,
      ],
    ],
    disciplinas: [["disciplina_id"], ...turmas.map((t) => [t.disciplina_id])],
    turmas: [
      ["turma_id", "periodo_id", "disciplina_id", "nome", "turno", "status"],
      ...turmas.map((t) =>
        campos(
          [
            "turma_id",
            "periodo_id",
            "disciplina_id",
            "nome",
            "turno",
            "status",
          ],
          { ...t },
        ),
      ),
    ],
    criterios_avaliacao: [cabC, ...criterios.map((c) => campos(cabC, c))],
    alunos: [
      ["aluno_id", "nome", "identificador_academico", "status", "email"],
    ],
    matriculas: [
      [
        "matricula_id",
        "aluno_id",
        "turma_id",
        "periodo_id",
        "status",
        "papel_na_turma",
      ],
    ],
    frequencias: [
      ["frequencia_id", "matricula_id", "data_aula", "status", "justificativa"],
    ],
    encontros_turma: [
      ["encontro_id", "turma_id", "data", "status", "chamada_salva"],
    ],
    avaliacoes: [
      ["avaliacao_id", "matricula_id", "criterio_id", "nota", "observacao"],
    ],
    grupos_pratica: [["grupo_id", "turma_id", "nome_grupo"]],
    grupo_integrantes: [
      [
        "grupo_integrante_id",
        "grupo_id",
        "matricula_id",
        "data_inicio",
        "data_fim",
        "status",
      ],
    ],
  },
});
const token = await amb.emissor.token("professora@exemplo.com");
const escrita = async (
  tabela: string,
  tipo: string,
  registro: Record<string, unknown>,
  esperado: Record<string, unknown> | null = null,
  op?: string,
) => {
  const r = await amb.worker.fetch(
    new Request("https://app.exemplo/api/critical-write", {
      method: "POST",
      headers: {
        "X-Firebase-Id-Token": token,
        Authorization: "Bearer google-ficticio",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tabela,
        tipo,
        registro,
        esperado: esperado
          ? {
              [String(amb.abas[tabela][0][0])]:
                registro[String(amb.abas[tabela][0][0])],
              ...esperado,
            }
          : null,
        operacaoId: op || `operacao-ficticia-${++i}`,
      }),
    }),
    amb.envWorker,
  );
  const body = (await r.json()) as { code?: string };
  return { status: r.status, body };
};
try {
 const mon=await amb.emissor.token('monitora@exemplo.com');
 const negada=await amb.worker.fetch(new Request('https://app.exemplo/api/critical-write',{method:'POST',headers:{'X-Firebase-Id-Token':mon,Authorization:'Bearer ficticio','Content-Type':'application/json'},body:JSON.stringify({operacaoId:'monitora-negada-2027',tabela:'frequencias',tipo:'INSERT',registro:{frequencia_id:'f-negada',matricula_id:'m-inexistente',turma_id:plano.turmas[0].turma_id,data_aula:'2027-02-08',status:'PRESENTE'},esperado:null})}),amb.envWorker);
 assert.equal(negada.status,403,'monitora delegada não faz chamada');

  assert.equal(
    (await escrita("periodos", "INSERT", { ...plano.periodo })).status,
    200,
  );
  for (const t of plano.turmas)
    assert.equal((await escrita("turmas", "INSERT", { ...t })).status, 200);
  for (const c of plano.criterios)
    assert.equal(
      (await escrita("criterios_avaliacao", "INSERT", c)).status,
      200,
    );
  const historico = JSON.stringify(amb.abas.criterios_avaliacao.slice(1, 7));
  const mats: Matricula[] = [];
  const pessoas = new Map<string, string>();
  for (let t = 0; t < 3; t++)
    for (let a = 0; a < 18; a++) {
      const ra = t === 1 && a < 3 ? `RA-0-${a}` : `RA-${t}-${a}`;
      let alunoId = pessoas.get(ra);
      if (!alunoId) {
        alunoId = id();
        pessoas.set(ra, alunoId);
        assert.equal(
          (
            await escrita("alunos", "INSERT", {
              aluno_id: alunoId,
              nome: `Pessoa fictícia ${t}-${a}`,
              identificador_academico: ra,
              status: "ATIVO",
              email: `pessoa${t}${a}@exemplo.invalid`,
            })
          ).status,
          200,
        );
      }
      const m: Matricula = {
        matricula_id: id(),
        aluno_id: alunoId,
        turma_id: plano.turmas[t].turma_id,
        periodo_id: plano.periodo.periodo_id,
        status: "PENDENTE",
        ...(t === 0 && a === 17
          ? { papel_na_turma: "SUPERVISAO_HORARIO_ALTERNATIVO" }
          : {}),
      };
      assert.equal(
        (await escrita("matriculas", "INSERT", { ...m })).status,
        200,
      );
      mats.push(m);
    }
  assert.equal(amb.abas.matriculas.length, 55);
  assert.equal(amb.abas.alunos.length, 52);
  assert.equal(
    (
      await escrita("matriculas", "INSERT", {
        ...mats[0],
        matricula_id: "duplicada",
      })
    ).body.code,
    "MATRICULA_DUPLICADA",
  );
  assert.equal(
    (
      await escrita("alunos", "INSERT", {
        aluno_id: "duplicado",
        nome: "Pessoa duplicada",
        identificador_academico: "ra-0-0",
        status: "ATIVO",
      })
    ).body.code,
    "ALUNO_DUPLICADO",
  );
  for (const m of mats) {
    assert.equal(
      (
        await escrita(
          "matriculas",
          "UPDATE",
          { matricula_id: m.matricula_id, status: "MATRICULADO" },
          { status: "PENDENTE" },
        )
      ).status,
      200,
    );
    m.status = "MATRICULADO";
  }
  const criterio = plano.criterios[0];
  const avaliacao = {
    avaliacao_id: id(),
    matricula_id: mats[0].matricula_id,
    criterio_id: criterio.criterio_id,
    nota: 0,
    observacao: "",
  };
  assert.equal(
    (await escrita("avaliacoes", "INSERT", avaliacao)).body.code,
    "RUBRICA_NAO_CONFIRMADA",
  );
  for (const c of plano.criterios)
    assert.equal(
      (
        await escrita(
          "criterios_avaliacao",
          "UPDATE",
          { criterio_id: c.criterio_id, status_validacao: "CONFIRMADO" },
          { status_validacao: "A_CONFERIR" },
        )
      ).status,
      200,
    );
  assert.equal(
    (
      await escrita(
        "avaliacoes",
        "INSERT",
        avaliacao,
        null,
        "avaliacao-ficticia-unica",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await escrita(
        "avaliacoes",
        "INSERT",
        avaliacao,
        null,
        "avaliacao-ficticia-unica",
      )
    ).status,
    200,
  );
  assert.equal(
    amb.abas.avaliacoes.length,
    2,
    "mesma operação não duplica nota zero",
  );
  assert.equal(
    (
      await escrita(
        "avaliacoes",
        "UPDATE",
        { avaliacao_id: avaliacao.avaliacao_id, nota: 2 },
        { nota: 0 },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await escrita(
        "avaliacoes",
        "UPDATE",
        { avaliacao_id: avaliacao.avaliacao_id, nota: 3 },
        { nota: 0 },
      )
    ).body.code,
    "VERSION_CONFLICT",
  );
  assert.equal(amb.abas.avaliacoes[1][3], 2);
  assert.equal(
    (
      await escrita(
        "avaliacoes",
        "UPDATE",
        { avaliacao_id: avaliacao.avaliacao_id, nota: 0 },
        { nota: 2 },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await escrita(
        "criterios_avaliacao",
        "UPDATE",
        { criterio_id: criterio.criterio_id, nota_maxima: 4 },
        { nota_maxima: 5 },
      )
    ).body.code,
    "CRITERIO_EM_USO",
  );
  const outro = plano.criterios.find(
    (c) => c.turma_id === plano.turmas[1].turma_id,
  )!;
  assert.equal(
    (
      await escrita("avaliacoes", "INSERT", {
        ...avaliacao,
        avaliacao_id: id(),
        criterio_id: outro.criterio_id,
      })
    ).body.code,
    "CRITERIO_FORA_DA_TURMA",
  );
  for (let semana = 0; semana < 6; semana++) {
    const data = new Date(Date.UTC(2027, 1, 8 + semana * 7))
      .toISOString()
      .slice(0, 10);
    for (const turma of plano.turmas) {
      const lista = mats
        .filter((m) => m.turma_id === turma.turma_id)
        .map((m) => ({ matricula: m, aluno: { nome: "Pessoa fictícia" } }));
      const previa = prepararEncerramentoChamada(
        lista,
        semana === 0 && turma.turma_id === plano.turmas[0].turma_id
          ? {
              [mats[0].matricula_id]: {
                faltou: true,
                atraso: false,
                celular: false,
              },
            }
          : {},
      );
      for (const f of previa.registros)
        assert.equal(
          (
            await escrita("frequencias", "INSERT", {
              frequencia_id: id(),
              matricula_id: f.matriculaId,
              data_aula: data,
              status: f.status,
              justificativa: f.justificativa || "",
            })
          ).status,
          200,
        );
      assert.equal(
        (
          await escrita("encontros_turma", "INSERT", {
            encontro_id: id(),
            turma_id: turma.turma_id,
            data,
            status: "REALIZADO",
            chamada_salva: true,
          })
        ).status,
        200,
      );
    }
  }
  assert.equal(
    amb.abas.frequencias.length,
    319,
    "6 semanas × 53 matrículas elegíveis, mais cabeçalho",
  );
  assert.equal(amb.abas.encontros_turma.length, 19);
  const frequenciaConfirmada = Object.fromEntries(
    amb.abas.frequencias[0].map((k: string, j: number) => [
      k,
      amb.abas.frequencias[1][j],
    ]),
  );
  assert.equal(
    (
      await escrita(
        "frequencias",
        "UPDATE",
        {
          frequencia_id: frequenciaConfirmada.frequencia_id,
          matricula_id: frequenciaConfirmada.matricula_id,
          data_aula: frequenciaConfirmada.data_aula,
          status: "PRESENTE",
        },
        frequenciaConfirmada,
      )
    ).body.code,
    "CHAMADA_ENCERRADA",
  );
  for (let g = 0; g < 3; g++) {
    const grupoId = `grupo-ficticio-${g}`;
    assert.equal(
      (
        await escrita("grupos_pratica", "INSERT", {
          grupo_id: grupoId,
          turma_id: plano.turmas[2].turma_id,
          nome_grupo: `Grupo fictício ${g + 1}`,
        })
      ).status,
      200,
    );
    for (const m of mats.slice(36 + g * 6, 42 + g * 6))
      assert.equal(
        (
          await escrita("grupo_integrantes", "INSERT", {
            grupo_integrante_id: id(),
            grupo_id: grupoId,
            matricula_id: m.matricula_id,
            data_inicio: "2027-02-08",
            data_fim: "",
            status: "ATIVO",
          })
        ).status,
        200,
      );
  }
  assert.equal(amb.abas.grupo_integrantes.length, 19);
  const coletivo = {
    monitoramento_id: "doc-ficticio",
    periodo_id: plano.periodo.periodo_id,
    turma_id: plano.turmas[2].turma_id,
    titular_tipo: "GRUPO",
    titular_id: "grupo-ficticio-0",
    status: "LOCALIZADO_RECENTE",
    data_modificacao_drive: "2027-03-01T12:00:00Z",
    consultado_em: "2027-03-01T13:00:00Z",
  } as MonitoramentoDocumento;
  const agora = new Date("2027-03-02T12:00:00Z");
  const a = documentosDoEstudante(
      [coletivo],
      mats[36].matricula_id,
      ["grupo-ficticio-0"],
      agora,
    ),
    b = documentosDoEstudante(
      [coletivo],
      mats[37].matricula_id,
      ["grupo-ficticio-0"],
      agora,
    );
  assert.equal(
    a.coletivos[0].id,
    b.coletivos[0].id,
    "metadado coletivo referenciado, não duplicado",
  );
  assert.equal(
    JSON.stringify(amb.abas.criterios_avaliacao.slice(1, 7)),
    historico,
    "rubricas anteriores preservadas",
  );
  assert.equal(
    (
      await escrita(
        "periodos",
        "UPDATE",
        { periodo_id: plano.periodo.periodo_id, status: "ARQUIVADO" },
        { status: "PLANEJADO" },
      )
    ).body.code,
    "PERIODO_COM_PENDENCIAS",
    "endpoint também recusa encerramento incompleto",
  );
  for (const m of mats)
    for (const c of plano.criterios.filter((c) => c.turma_id === m.turma_id)) {
      if (
        m.matricula_id === avaliacao.matricula_id &&
        c.criterio_id === avaliacao.criterio_id
      )
        continue;
      assert.equal(
        (
          await escrita("avaliacoes", "INSERT", {
            avaliacao_id: id(),
            matricula_id: m.matricula_id,
            criterio_id: c.criterio_id,
            nota: 0,
            observacao: "",
          })
        ).status,
        200,
      );
    }
  assert.equal(
    (
      await escrita(
        "periodos",
        "UPDATE",
        { periodo_id: plano.periodo.periodo_id, status: "ARQUIVADO" },
        { status: "PLANEJADO" },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await escrita(
        "avaliacoes",
        "UPDATE",
        { avaliacao_id: avaliacao.avaliacao_id, nota: 1 },
        { nota: 0 },
      )
    ).body.code,
    "PERIODO_ARQUIVADO",
  );
  assert.equal(
    (
      await escrita(
        "matriculas",
        "UPDATE",
        { matricula_id: mats[0].matricula_id, status: "TRANCADO" },
        { status: "MATRICULADO" },
      )
    ).body.code,
    "PERIODO_ARQUIVADO",
  );
  assert.equal(amb.abas.avaliacoes[1][3], 0);
  console.log(
    "Integração local: cadastro 2027.1, 54 inscrições/aprovações, seis semanas, 318 frequências, 18 encontros, rubricas protegidas, replay e arquivo histórico aprovados.",
  );
  console.log(
    "Worker handler/coordenador executados; Google e armazenamento simulados. Arquivamento técnico testado não comprova encerramento acadêmico completo.",
  );
} finally {
  amb.restaurar();
}
