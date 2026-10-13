/**
 * Condições da matrícula guardadas em `papel_na_turma` (sem cadastro paralelo).
 * O campo pode combinar valores separados por ; , | ou espaço — ex.: "REPRESENTANTE;SUPERVISAO_HORARIO_ALTERNATIVO".
 */
export const SUPERVISAO_HORARIO_ALTERNATIVO = 'SUPERVISAO_HORARIO_ALTERNATIVO';
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function condicoesDaMatricula(m: { papel_na_turma?: unknown } | null | undefined): string[] {
  return semAcento(String(m?.papel_na_turma ?? '')).toUpperCase().split(/[;,|\s]+/).map(x => x.trim()).filter(Boolean);
}
/** A matrícula tem supervisão em horário alternativo: encontros coletivos desta turma não geram presença nem falta automática. */
export const temSupervisaoHorarioAlternativo = (m: { papel_na_turma?: unknown } | null | undefined): boolean =>
  condicoesDaMatricula(m).includes(SUPERVISAO_HORARIO_ALTERNATIVO);
export const ROTULO_HORARIO_ALTERNATIVO = 'Supervisão em horário alternativo';

/**
 * Regra da chamada por exceção: quem não foi marcado conta como presente SOMENTE depois de a professora confirmar.
 * Matrícula com supervisão em horário alternativo nunca recebe presença (nem falta) automática no encontro coletivo;
 * só tem registro se a professora marcar explicitamente.
 */
export const geraRegistroAutomatico = (m: { papel_na_turma?: unknown }, temMarcacaoExplicita: boolean): boolean =>
  temMarcacaoExplicita || !temSupervisaoHorarioAlternativo(m);
