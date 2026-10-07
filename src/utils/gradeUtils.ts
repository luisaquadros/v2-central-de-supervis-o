/**
 * Normaliza e formata notas acadêmicas com segurança,
 * garantindo que ausência de nota (null, undefined, "") seja representada por "—"
 * em vez de virar 0.0 de forma silenciosa.
 */

export function normalizarNota(val: any): number | 'ausente' | 'invalido' {
  if (val === null || val === undefined || String(val).trim() === '') {
    return 'ausente';
  }

  if (typeof val === 'number') {
    return isNaN(val) ? 'invalido' : val;
  }

  let str = String(val).trim();
  // decimal com vírgula (ex: "8,5" -> "8.5")
  str = str.replace(',', '.');

  const num = Number(str);
  if (isNaN(num)) {
    return 'invalido';
  }

  return num;
}

export function formatarNotaParaExibicao(val: any): string {
  const norm = normalizarNota(val);
  if (norm === 'ausente') return '—';
  if (norm === 'invalido') return '—'; // ou "—" para manter visual limpo
  return norm.toFixed(1);
}
