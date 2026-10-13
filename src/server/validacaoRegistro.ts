import { PRIMARY_KEYS } from "../services/recordIdentity";
import {
  adaptarRegistroCritico,
  idCritico,
  type EscritaCritica,
} from "./coordenacaoCritica";
import { numeroAcademico, dataAcademica } from "../services/valoresAcademicos";

/** Validação de formato, sem inventar rubricas ou regras acadêmicas. */
export function validarRegistro(p: EscritaCritica): void {
  if (Array.isArray(p.registro))
    throw new Error("O registro deve ser um objeto.");
  const r = adaptarRegistroCritico(p.tabela, p.registro);
  idCritico(p.tabela, r);
  const pk = PRIMARY_KEYS[p.tabela];
  if (r[pk] == null || typeof r[pk] === "object" || !String(r[pk]).trim())
    throw new Error("Chave primária obrigatória.");
  for (const [k, v] of Object.entries(r)) {
    if (["__proto__", "constructor", "prototype"].includes(k))
      throw new Error("Campo inválido.");
    if (typeof v === "string" && v.length > 50000)
      throw new Error("Campo excede o limite permitido.");
    if (
      k.endsWith("_id") &&
      v != null &&
      typeof v !== "string" &&
      typeof v !== "number"
    )
      throw new Error("Identificador inválido.");
    if (["nota", "nota_final", "nota_maxima", "peso"].includes(k)) {
      const n = numeroAcademico(v);
      if (n !== null && n < 0)
        throw new Error("Nota/peso não pode ser negativo.");
    }
    if (
      k === "status" &&
      p.tabela === "frequencias" &&
      ![
        "PRESENTE",
        "ATRASO",
        "FALTA_SEM_JUSTIFICATIVA",
        "FALTA_JUSTIFICADA",
        "JUSTIFICATIVA_PENDENTE",
      ].includes(String(v))
    )
      throw new Error("Status de frequência inválido.");
    if (
      ["data", "data_aula", "data_inicio", "data_fim", "data_prazo"].includes(
        k,
      ) &&
      v
    ) {
      const d = dataAcademica(v);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
        !Number.isFinite(Date.parse(d)) ||
        new Date(d).toISOString().slice(0, 10) !== d
      )
        throw new Error("Data inválida.");
    }
  }
}
export function valorCelula(v: unknown): string | number | boolean {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return typeof v === "boolean"
    ? v
      ? "TRUE"
      : "FALSE"
    : (v as string | number);
}
