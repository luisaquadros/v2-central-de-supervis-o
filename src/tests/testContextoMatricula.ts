import { strict as assert } from "node:assert";
import { registroDaMatricula } from "../services/contextoMatricula";
import type { Matricula } from "../types";
const a = {
  matricula_id: "m-a",
  aluno_id: "a",
  turma_id: "t-a",
  periodo_id: "p",
} as Matricula;
const b = { ...a, matricula_id: "m-b", turma_id: "t-b" };
assert.equal(
  registroDaMatricula({ matricula_id: "m-b", aluno_id: "a" }, a, [a, b]),
  false,
);
assert.equal(registroDaMatricula({ matricula_id: "m-a" }, a, [a, b]), true);
assert.equal(
  registroDaMatricula({ aluno_id: "a" }, a, [a, b]),
  false,
  "legado ambíguo não se duplica em duas turmas",
);
assert.equal(
  registroDaMatricula({ aluno_id: "a", turma_id: "t-a" }, a, [a, b]),
  true,
);
assert.equal(
  registroDaMatricula({ aluno_id: "a" }, a, [a]),
  true,
  "legado inequivocamente vinculado continua visível",
);
console.log(
  "Contexto da matrícula: turma explícita e legado ambíguo preservados.",
);
