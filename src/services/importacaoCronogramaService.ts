import type { MarcoAcademico } from "../types";
/** CSV delimitado, incluindo aspas e separadores dentro de campos. */
export function lerCsv(texto: string): Record<string, string>[] {
  const separador = texto.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [],
    campo = "",
    aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (aspas && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else aspas = !aspas;
    } else if (!aspas && (c === separador || c === "\n")) {
      linha.push(campo.replace(/\r$/, "").trim());
      campo = "";
      if (c === "\n") {
        linhas.push(linha);
        linha = [];
      }
    } else campo += c;
  }
  if (aspas) throw new Error("CSV com aspas não encerradas.");
  if (campo || linha.length) {
    linha.push(campo.trim());
    linhas.push(linha);
  }
  const cab = (linhas.shift() || []).map((s) =>
    s.replace(/^\uFEFF/, "").toLowerCase(),
  );
  if (new Set(cab).size !== cab.length)
    throw new Error("Cabeçalhos repetidos no CSV.");
  return linhas
    .filter((l) => l.some(Boolean))
    .map((l) => Object.fromEntries(cab.map((h, i) => [h, l[i] || ""])));
}
const TIPOS = new Set([
  "PROVA",
  "ENTREGA",
  "RELATORIO",
  "ENCERRAMENTO_ATENDIMENTOS",
  "DEVOLUTIVA",
  "OUTRO",
]);
export function prepararCronograma(
  texto: string,
  turma: { turma_id: string; periodo_id: string; disciplina_id: string },
  existentes: MarcoAcademico[],
  id: () => string = () => crypto.randomUUID(),
) {
  const itens = lerCsv(texto);
  if (!itens.length) throw new Error("Informe ao menos um marco.");
  const vistos = new Set(
    existentes
      .filter((m) => m.turma_id === turma.turma_id)
      .map((m) => `${m.nome}|${m.data_prazo}|${m.tipo}`),
  );
  return itens.map((r, i) => {
    const data = r.data_prazo || r.data,
      nome = r.nome || r.titulo,
      tipo = (r.tipo || "OUTRO").toUpperCase();
    if (
      !nome ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      Number.isNaN(Date.parse(data)) ||
      new Date(data).toISOString().slice(0, 10) !== data
    )
      throw new Error(
        `Linha ${i + 2}: informe título e data válida; datas ausentes não são inferidas.`,
      );
    if (!TIPOS.has(tipo))
      throw new Error(
        `Linha ${i + 2}: use tipo oficial ou OUTRO com codigo_marco específico.`,
      );
    const chave = `${nome}|${data}|${tipo}`;
    if (vistos.has(chave))
      throw new Error(
        `Linha ${i + 2}: marco já existente ou repetido. Nenhum registro será substituído.`,
      );
    vistos.add(chave);
    const escopo = (r.escopo_marco || r.visibilidade || "TURMA").toUpperCase();
    if (!["TURMA", "DOCENTE", "DISCIPLINA"].includes(escopo))
      throw new Error("Visibilidade inválida: TURMA, DOCENTE ou DISCIPLINA.");
    const status = (r.status || "PLANEJADO").toUpperCase();
    if (!["PLANEJADO", "CONFIRMADO", "ADIADO", "CUMPRIDO"].includes(status))
      throw new Error("Status de marco inválido.");
    return {
      ...turma,
      marco_id: id(),
      nome,
      tipo: tipo as MarcoAcademico["tipo"],
      data_prazo: data,
      status: status as MarcoAcademico["status"],
      origem: r.origem || "IMPORTACAO_MANUAL",
      escopo_marco: escopo,
      codigo_marco: r.codigo_marco || "",
      observacao: r.observacao || "",
    };
  });
}
