/** Formatos oficiais de datas, compartilhados por leitura, identidade e escrita. */
export function dataAcademica(valor: unknown): string {
  const t = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{5}(?:[.,]\d+)?$/.test(t))
    return new Date(
      Date.UTC(1899, 11, 30) +
        Math.floor(Number(t.replace(",", "."))) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  return t;
}
export function numeroAcademico(valor: unknown): number | null {
  if (valor == null || String(valor).trim() === "") return null;
  const n = Number(String(valor).trim().replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Valor numérico inválido.");
  return n;
}
