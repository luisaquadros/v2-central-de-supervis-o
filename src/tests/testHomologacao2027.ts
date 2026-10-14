import { validarAvaliacaoCompleta } from "../server/validacaoAvaliacaoCompleta";
import { strict as assert } from "node:assert";
import {
  planejarPeriodo,
  validarNovoPeriodo,
} from "../services/semestreService";
import {
  prepararCronograma,
  lerCsv,
} from "../services/importacaoCronogramaService";
import { revisarEncerramento } from "../services/encerramentoPeriodoService";
import { conferirIntegridadeSemestre } from "../server/integridadeSemestre";
import { registroDaMatricula } from "../services/contextoMatricula";
import { listarAlunosChamada } from "../services/aulaParticipants";
import {
  prepararEncerramentoChamada,
  naoRegistrados,
} from "../services/chamadaService";
import { gerarBackup, validarBackup } from "../services/backupService";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { createRequire } from "node:module";
import type {
  Periodo,
  Turma,
  Matricula,
  Aluno,
  CriterioAvaliacao,
} from "../types";
const require = createRequire(import.meta.url),
  { PNG } = require("pngjs");
let n = 0;
const id = () => `sintetico-${++n}`;
const anterior: Periodo = {
  periodo_id: "p-2026",
  nome: "2026.2",
  data_inicio: "2026-08-01",
  data_fim: "2026-12-20",
  status: "ARQUIVADO",
};
const turmasBase = Array.from(
  { length: 3 },
  (_, i) =>
    ({
      turma_id: `t-ant-${i}`,
      periodo_id: anterior.periodo_id,
      disciplina_id: `d-${i}`,
      nome: `Turma fictícia ${i + 1}`,
      turno: "MATUTINO",
      status: "ATIVO",
    }) as Turma,
);
const criteriosBase = turmasBase.flatMap((t) =>
  [0, 1].map(
    (i) =>
      ({
        criterio_id: `c-${t.turma_id}-${i}`,
        periodo_id: anterior.periodo_id,
        turma_id: t.turma_id,
        disciplina_id: t.disciplina_id,
        nome: `Critério fictício ${i + 1}`,
        nota_maxima: 5,
        peso: 1,
        ativo: true,
      }) as CriterioAvaliacao,
  ),
);
const base = {
  periodos: [anterior],
  turmas: turmasBase,
  criterios: criteriosBase,
  horarios: [{horario_id:"h-antigo",turma_id:turmasBase[0].turma_id,dia_semana:1,hora_inicio:"08:00",hora_fim:"10:00",data_inicio:"2026-08-01",data_fim:"2026-12-20",ativo:true,status_encontro:"CANCELADO" as const,data_reagendada:"2026-09-01",total_aulas_previstas:22}],
};
const antes = JSON.stringify(base);
const plano = planejarPeriodo(
  {
    nome: "2027.1",
    inicio: "2027-02-01",
    fim: "2027-06-30",
    inicioAulas: "2027-02-08",
    modelo: anterior.periodo_id,
  },
  base,
  id,
);
assert.equal(
  JSON.stringify(base),
  antes,
  "histórico e rubricas originais imutáveis",
);
assert.equal(plano.horarios[0].data_inicio,'2027-02-08');
assert.equal(plano.horarios[0].data_fim,'2027-06-30');
assert(!('status_encontro' in plano.horarios[0]));
assert(!('data_reagendada' in plano.horarios[0]));
assert(!('total_aulas_previstas' in plano.horarios[0]));
assert.equal(plano.turmas.length, 3);
assert.equal(plano.criterios.length, 6);
assert.equal(plano.marcos[0].data_prazo, "2027-02-08");
assert.ok(
  plano.criterios.every(
    (c) =>
      c.status_validacao === "A_CONFERIR" &&
      plano.turmas.some((t) => t.turma_id === c.turma_id),
  ),
);
assert.throws(() =>
  validarNovoPeriodo("2027.1", "2027-06-30", "2027-02-01", []),
);
assert.throws(() =>
  validarNovoPeriodo("2026.2", "2027-02-01", "2027-06-30", [anterior]),
);
assert.throws(() =>
  validarNovoPeriodo("2027.1", "2027-02-30", "2027-06-30", []),
);
const alunos: Aluno[] = [],
  matriculas: Matricula[] = [];
for (let t = 0; t < 3; t++)
  for (let a = 0; a < 18; a++) {
    const alunoId = t === 1 && a < 3 ? `aluno-0-${a}` : `aluno-${t}-${a}`;
    if (!alunos.some((x) => x.aluno_id === alunoId))
      alunos.push({
        aluno_id: alunoId,
        nome: `Pessoa fictícia ${alunoId}`,
        identificador_academico: `RA-${alunoId}`,
        status: "ATIVO",
      });
    matriculas.push({
      matricula_id: `m-${t}-${a}`,
      aluno_id: alunoId,
      turma_id: plano.turmas[t].turma_id,
      periodo_id: plano.periodo.periodo_id,
      status: "MATRICULADO",
      ...(t === 0 && a === 17
        ? { papel_na_turma: "SUPERVISAO_HORARIO_ALTERNATIVO" }
        : {}),
    });
  }
assert.equal(matriculas.length, 54);
assert.equal(alunos.length, 51);
assert.equal(
  new Set(matriculas.map((m) => `${m.turma_id}|${m.aluno_id}`)).size,
  54,
);
const chamada = listarAlunosChamada(
  plano.turmas[0].turma_id,
  matriculas,
  alunos,
);
assert.equal(
  chamada.length,
  18,
  "lista preserva a matrícula de supervisão alternativa",
);
assert.equal(naoRegistrados(chamada, {}).length, 18);
const previa = prepararEncerramentoChamada(chamada, {});
assert.equal(
  previa.semRegistro.length,
  1,
  "supervisão alternativa não recebe registro automático",
);
assert.equal(previa.registros.length, 17, "prévia não equivale a gravação");
const titular = matriculas[0];
assert.equal(
  registroDaMatricula(
    { matricula_id: "m-1-0", aluno_id: titular.aluno_id },
    titular,
    matriculas,
  ),
  false,
);
const marcos = prepararCronograma(
  "nome;data;tipo;codigo_marco;status;visibilidade\nProva fictícia;2027-05-10;PROVA;PROVA_1;CONFIRMADO;DOCENTE",
  plano.turmas[0],
  [],
  id,
);
assert.equal(marcos[0].escopo_marco, "DOCENTE");
assert.throws(() =>
  prepararCronograma(
    "nome;data;tipo\nProva fictícia;2027-05-10;PROVA",
    plano.turmas[0],
    marcos,
    id,
  ),
);
assert.throws(() =>
  prepararCronograma(
    "nome;data;tipo\nSem data;;OUTRO",
    plano.turmas[0],
    [],
    id,
  ),
);
assert.equal(
  lerCsv(
    'nome,email,identificador_academico\n"Pessoa, fictícia",pessoa@exemplo.invalid,RA-FICTICIO',
  )[0].nome,
  "Pessoa, fictícia",
);
const avaliacoes = matriculas.flatMap((m) =>
  plano.criterios
    .filter((c) => c.turma_id === m.turma_id)
    .map((c) => ({
      avaliacao_id: id(),
      matricula_id: m.matricula_id,
      criterio_id: c.criterio_id,
      nota: 0,
      observacao: "",
    })),
);
const revisao = revisarEncerramento(plano.periodo, {
  turmas: plano.turmas,
  matriculas,
  criterios: plano.criterios.map(c=>({...c,status_validacao:"CONFIRMADO"})),
  avaliacoes,
  pendencias: [],
  pendentesSync: 0,
});
assert.equal(revisao.pendencias.length, 0, "zero é avaliado, não ausente");
assert.equal(
  revisarEncerramento(plano.periodo, {
    turmas: plano.turmas,
    matriculas,
    criterios: plano.criterios.map(c=>({...c,status_validacao:"CONFIRMADO"})),
    avaliacoes: [],
    pendencias: [],
    pendentesSync: 1,
  }).pendencias.length,
  55,
);
for (const t of plano.turmas)
  assert.equal(
    plano.criterios
      .filter((c) => c.turma_id === t.turma_id)
      .reduce((s, c) => s + Number(c.nota_maxima), 0),
    10,
    "somente a rubrica fictícia do cenário soma 10",
  );
const dados: Record<string, Record<string, unknown>[]> = {
  periodos: [{ ...plano.periodo, status: "ARQUIVADO" }],
  turmas: plano.turmas.map((t) => ({ ...t })),
  matriculas: matriculas.map((m) => ({ ...m })),
  grupos_pratica: [],
  criterios_avaliacao: plano.criterios.map((c) => ({ ...c })),
};
const ler = async (t: string) => dados[t] || [];
await assert.rejects(
  () =>
    conferirIntegridadeSemestre(
      "frequencias",
      "INSERT",
      { matricula_id: "m-0-0", periodo_id: "forjado" },
      null,
      [],
      ler,
    ),
  /histórico/,
  "período fornecido pelo cliente não substitui matrícula oficial",
);
await assert.rejects(() =>
  conferirIntegridadeSemestre(
    "matriculas",
    "INSERT",
    {
      matricula_id: "outra",
      aluno_id: matriculas[0].aluno_id,
      turma_id: plano.turmas[0].turma_id,
      periodo_id: "errado",
    },
    null,
    matriculas.map((m) => ({ ...m })),
    ler,
  ),
);
dados.periodos[0].status = "ATIVO";
await assert.rejects(
  () =>
    conferirIntegridadeSemestre(
      "matriculas",
      "INSERT",
      { ...matriculas[0], matricula_id: "outra" },
      null,
      matriculas.map((m) => ({ ...m })),
      ler,
    ),
  /já possui matrícula/,
);
await assert.rejects(
  () =>
    conferirIntegridadeSemestre(
      "alunos",
      "INSERT",
      {
        ...alunos[0],
        aluno_id: "outro",
        identificador_academico:
          alunos[0].identificador_academico.toLowerCase(),
      },
      null,
      alunos.map((a) => ({ ...a })),
      ler,
    ),
  /já cadastrado/,
);
await assert.rejects(
  () =>
    validarAvaliacaoCompleta(
      {
        matricula_id: "m-0-0",
        turma_id: plano.turmas[0].turma_id,
        status: "AVALIADA",
        nota_final: 0,
        notas_criterios: [],
      },
      ler,
    ),
  /rubrica/i,
);
for (const c of dados.criterios_avaliacao) c.status_validacao = "CONFIRMADO";
const notas = plano.criterios
  .filter((c) => c.turma_id === plano.turmas[0].turma_id)
  .map((c) => ({ criterio_id: c.criterio_id, nota: 0 }));
await validarAvaliacaoCompleta(
  {
    matricula_id: "m-0-0",
    turma_id: plano.turmas[0].turma_id,
    status: "AVALIADA",
    nota_final: 0,
    notas_criterios: notas,
  },
  ler,
);
await assert.rejects(
  () =>
    validarAvaliacaoCompleta(
      {
        matricula_id: "m-0-0",
        status: "AVALIADA",
        nota_final: 1,
        notas_criterios: notas,
      },
      ler,
    ),
  /total informado/i,
);
await assert.rejects(
  () =>
    validarAvaliacaoCompleta(
      {
        matricula_id: "m-0-0",
        status: "AVALIADA",
        nota_final: 0,
        notas_criterios: [notas[0], notas[0]],
      },
      ler,
    ),
  /repetido/i,
);
await assert.rejects(
  () =>
    validarAvaliacaoCompleta(
      {
        matricula_id: "m-0-0",
        status: "RASCUNHO",
        nota_final: -1,
        notas_criterios: [{ ...notas[0], nota: -1 }],
      },
      ler,
    ),
  /incompatível/i,
);
const backup = await gerarBackup({
  periodos: [{ ...plano.periodo }],
  disciplinas: plano.turmas.map((t) => ({ disciplina_id: t.disciplina_id })),
  turmas: plano.turmas.map((t) => ({ ...t })),
  alunos: alunos.map((a) => ({ ...a })),
  matriculas: matriculas.map((m) => ({ ...m })),
  criterios_avaliacao: plano.criterios,
  avaliacoes,
});
assert.equal(
  (await validarBackup(JSON.parse(JSON.stringify(backup)))).ok,
  true,
);
const link = "https://docs.google.com/forms/d/e/formulario-ficticio/viewform";
const png = await QRCode.toBuffer(link, {
  width: 400,
  margin: 4,
  errorCorrectionLevel: "M",
});
const decodedPng = PNG.sync.read(png);
assert.equal(
  jsQR(
    new Uint8ClampedArray(decodedPng.data),
    decodedPng.width,
    decodedPng.height,
  )?.data,
  link,
  "QR Code decodificado opticamente",
);
console.log(
  "2027.1: 3 turmas, 54 matrículas, 51 alunos, clone, cronograma, chamada alternativa, notas zero, histórico, duplicidades, backup e QR aprovados com dados fictícios.",
);
console.log(
  "Lacunas não simuladas como sucesso: participação/competências estruturadas, reposição completa e homologação institucional de ponta a ponta. Pareceres/rubricas recentes são cobertos pelos testes específicos.",
);
