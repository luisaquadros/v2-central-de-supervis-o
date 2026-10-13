/**
 * Contrato canônico de leitura da base acadêmica.
 * Preserva significado, não preenche informações ausentes.
 */
const uniforme = (value: unknown) => String(value ?? '')
  .trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '_');

export function interpretarFrequenciaOficial(status: unknown, atraso: unknown = false) {
  const codigo = uniforme(status);
  const ehAtraso = codigo === 'ATRASO' || atraso === true ||
    ['TRUE', 'VERDADEIRO', '1'].includes(uniforme(atraso));
  // Na base legada ATRASO significa presença com atraso, nunca falta.
  const normalizado = codigo === 'ATRASO' ? 'PRESENTE' : codigo;
  const aceitos = ['PRESENTE', 'FALTA_SEM_JUSTIFICATIVA', 'FALTA_JUSTIFICADA', 'JUSTIFICATIVA_PENDENTE'];
  return { status: aceitos.includes(normalizado) ? normalizado : 'NAO_IDENTIFICADO',
    atraso: ehAtraso, statusOriginal: codigo };
}

export function statusFrequenciaParaPlanilha(status: string, atraso: boolean): string {
  // A planilha de frequência de 2026 não tem coluna atraso; preserva informação no status.
  return status === 'PRESENTE' && atraso ? 'ATRASO' : status;
}

export function interpretarStatusEntrega(status: unknown): 'ENVIADO'|'ENTREGUE'|'A_CONFERIR'|'PENDENTE'|'NAO_SE_APLICA'|'DESCONHECIDO' {
  const codigo = uniforme(status);
  if (codigo === 'ENVIADO') return 'ENVIADO';
  if (codigo === 'ENTREGUE') return 'ENTREGUE';
  if (codigo === 'A_CONFERIR') return 'A_CONFERIR';
  if (codigo === 'PENDENTE') return 'PENDENTE';
  if (codigo === 'NAO_SE_APLICA') return 'NAO_SE_APLICA';
  return 'DESCONHECIDO';
}
