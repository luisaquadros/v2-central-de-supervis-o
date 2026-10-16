/**
 * Perfis e permissões, decididos no servidor. A configuração vem de variáveis do Worker (não da planilha):
 * quem edita a planilha não consegue conceder acesso a si mesmo.
 *
 *   ADMIN_EMAILS   = "professora@exemplo.com"                      (lista simples, perfil PROFESSORA_ADMIN)
 *   ACESSOS_JSON   = {"administradoras":["..."],
 *                     "monitoras":[{"email":"...","turmas":["turma-2b"],"operacoes":["CHAMADA","ENTREGAS"]}]}
 *
 * Sem nenhuma conta configurada, ninguém grava nem lê pelo servidor (falha fechada).
 * Nenhum acesso estudantil existe nesta versão.
 */
export type Papel = 'PROFESSORA_ADMIN' | 'MONITORA';
export type Operacao = 'CHAMADA' | 'ENTREGAS' | 'DOCUMENTOS_VER' | 'CONTRIBUICAO_AVALIATIVA';
export const OPERACOES_DELEGAVEIS: readonly Operacao[] = ['CHAMADA', 'ENTREGAS', 'DOCUMENTOS_VER', 'CONTRIBUICAO_AVALIATIVA'];

export interface Perfil { papel: Papel; email: string; turmas: string[]; operacoes: Operacao[] }
export interface AmbienteAcessos { ADMIN_EMAILS?: string; ACESSOS_JSON?: string }

const emailValido = (e: unknown): e is string => typeof e === 'string' && /^[^@\s]+@[^@\s]+$/.test(e.trim());

export interface ConfiguracaoAcessos { administradoras: Set<string>; monitoras: Map<string, { turmas: string[]; operacoes: Operacao[] }>; avisos: string[] }
export function lerConfiguracaoAcessos(env: AmbienteAcessos): ConfiguracaoAcessos {
  const administradoras = new Set<string>(), monitoras = new Map<string, { turmas: string[]; operacoes: Operacao[] }>(), avisos: string[] = [];
  for (const e of (env.ADMIN_EMAILS ?? '').split(/[,;\s]+/)) if (emailValido(e)) administradoras.add(e.trim().toLowerCase());
  if (env.ACESSOS_JSON?.trim()) {
    try {
      const j = JSON.parse(env.ACESSOS_JSON) as { administradoras?: unknown[]; monitoras?: { email?: unknown; turmas?: unknown; operacoes?: unknown }[] };
      for (const e of j.administradoras ?? []) if (emailValido(e)) administradoras.add(e.trim().toLowerCase()); else avisos.push('administradora com e-mail inválido ignorada');
      for (const m of j.monitoras ?? []) {
        if (!emailValido(m.email)) { avisos.push('monitora com e-mail inválido ignorada'); continue; }
        const turmas = Array.isArray(m.turmas) ? m.turmas.filter((t): t is string => typeof t === 'string' && t.trim() !== '' && t !== '*').map(t => t.trim()) : [];
        const operacoes = Array.isArray(m.operacoes) ? m.operacoes.filter((o): o is Operacao => OPERACOES_DELEGAVEIS.includes(o as Operacao)) : [];
        if (!turmas.length || !operacoes.length) { avisos.push('monitora sem turmas ou sem operações delegadas ignorada (acesso restrito exige os dois)'); continue; }
        monitoras.set(m.email.trim().toLowerCase(), { turmas, operacoes });
      }
    } catch { avisos.push('ACESSOS_JSON inválido: nenhuma monitora foi habilitada'); }
  }
  return { administradoras, monitoras, avisos };
}
export const acessosConfigurados = (c: ConfiguracaoAcessos) => c.administradoras.size > 0 || c.monitoras.size > 0;

/** Administradora tem prioridade. Devolve null se a conta não tem nenhum papel. */
export function resolverPerfil(email: string, c: ConfiguracaoAcessos): Perfil | null {
  const e = email.toLowerCase();
  if (c.administradoras.has(e)) return { papel: 'PROFESSORA_ADMIN', email: e, turmas: ['*'], operacoes: [...OPERACOES_DELEGAVEIS] };
  const m = c.monitoras.get(e);
  return m ? { papel: 'MONITORA', email: e, turmas: m.turmas, operacoes: m.operacoes } : null;
}

/** Tabelas que cada operação delegada pode GRAVAR. Tudo o que não está aqui é negado à monitora. */
export const ESCRITA_POR_OPERACAO: Record<Operacao, string[]> = {
  CHAMADA: ['frequencias', 'encontros_turma'], ENTREGAS: ['entregas'], DOCUMENTOS_VER: [],
  // Contribuição qualitativa PRELIMINAR (validada linha a linha em validarContribuicaoMonitora): nunca nota, rubrica ou peso.
  CONTRIBUICAO_AVALIATIVA: ['evidencias_avaliacao'],
};

export type Decisao = { ok: true } | { ok: false; code: 'OPERACAO_NAO_DELEGADA' | 'FORA_DA_TURMA' | 'TURMA_INDETERMINADA'; message: string };
const nega = (code: Extract<Decisao, { ok: false }>['code'], message: string): Decisao => ({ ok: false, code, message });

export function podeEscreverTabela(p: Perfil, tabela: string, tipo: 'INSERT' | 'UPDATE' | 'DELETE'): Decisao {
  if (p.papel === 'PROFESSORA_ADMIN') return { ok: true };
  if (tipo === 'DELETE') return nega('OPERACAO_NAO_DELEGADA', 'Monitoras não excluem registros.');
  const liberadas = new Set(p.operacoes.flatMap(o => ESCRITA_POR_OPERACAO[o]));
  return liberadas.has(tabela) ? { ok: true } : nega('OPERACAO_NAO_DELEGADA', 'Esta operação não foi delegada a esta conta.');
}
export function turmaPermitida(p: Perfil, turmaId: string | undefined): Decisao {
  if (p.papel === 'PROFESSORA_ADMIN') return { ok: true };
  if (!turmaId) return nega('TURMA_INDETERMINADA', 'Não foi possível determinar a turma do registro; gravação negada.');
  return p.turmas.includes(turmaId) ? { ok: true } : nega('FORA_DA_TURMA', 'Registro de uma turma que não foi delegada a esta conta.');
}
/** Turma do registro: coluna turma_id, ou a turma da matrícula. Indeterminada ⇒ negado (falha fechada). */
export function turmaDoRegistro(registro: Record<string, unknown> | null, turmaDaMatricula: (matriculaId: string) => string | undefined): string | undefined {
  if (!registro) return undefined;
  const t = String(registro.turma_id ?? '').trim();
  if (t) return t;
  const m = String(registro.matricula_id ?? '').trim();
  return m ? turmaDaMatricula(m) : undefined;
}

// ---------------------------------------------------------------------------------------------
// Leitura filtrada (monitoras). Notas, ocorrências, devolutivas, RSS e demais registros
// confidenciais nunca estão nesta lista.
// ---------------------------------------------------------------------------------------------
interface RegraLeitura { operacao?: Operacao; porTurma?: 'turma_id' | 'matricula_id' | 'aluno_id' | 'grupo_id'; ocultar?: string[]; todas?: boolean;
  /** LISTA BRANCA de colunas: só estas saem (use para tabelas com conteúdo clínico) */ somente?: string[];
  /** filtro adicional por linha (ex.: somente as próprias contribuições) */ linha?: (l: Record<string, string>, p: Perfil) => boolean }
export const LEITURA_MONITORA: Record<string, RegraLeitura> = {
  periodos: { todas: true }, disciplinas: { todas: true },
  turmas: { porTurma: 'turma_id' }, horarios_turma: { porTurma: 'turma_id' }, matriculas: { porTurma: 'turma_id' },
  alunos: { porTurma: 'aluno_id', somente: ['aluno_id', 'nome', 'identificador_academico', 'status'] },
  grupos_pratica: { porTurma: 'turma_id' }, grupo_integrantes: { porTurma: 'grupo_id' },
  encontros_turma: { operacao: 'CHAMADA', porTurma: 'turma_id', ocultar: ['observacao'] },
  frequencias: { operacao: 'CHAMADA', porTurma: 'matricula_id', ocultar: ['justificativa', 'observacao'] },
  entregas: { operacao: 'ENTREGAS', porTurma: 'matricula_id', ocultar: ['observacao'] },
  monitoramento_documentos: { operacao: 'DOCUMENTOS_VER', porTurma: 'turma_id', ocultar: ['observacao', 'observacao_manual', 'observacao_administrativa'] },
  // RSS: a monitora vê só o STATUS ADMINISTRATIVO das entregas (unidade, turma, semana, data, status). Lista branca: nenhuma coluna
  // com conteúdo clínico, nome de autor ou observação sai, mesmo que a planilha ganhe colunas novas.
  registros_semanais: { operacao: 'ENTREGAS', porTurma: 'turma_id', somente: ['registro_id', 'matricula_id', 'grupo_id', 'turma_id', 'escopo', 'data_entrega', 'semana_rss', 'status', 'status_revisao'] },
  status_rss_unidades: { operacao: 'ENTREGAS', porTurma: 'turma_id', somente: ['turma_id', 'unidade_id', 'unidade_tipo', 'rss_esperados_ate_hoje', 'rss_recebidos_validos', 'saldo_rss', 'status_rss'] },
  calendario_rss: { operacao: 'ENTREGAS', porTurma: 'turma_id', somente: ['rss_previsto_id', 'turma_id', 'sequencia', 'semana_inicio', 'semana_fim', 'status_calendario'] },
  regras_rss: { operacao: 'ENTREGAS', porTurma: 'turma_id', somente: ['regra_rss_id', 'turma_id', 'total_previsto', 'data_inicio', 'data_fim'] },
  situacao_atual_turmas: { operacao: 'ENTREGAS', porTurma: 'turma_id', somente: ['turma_id', 'turma_nome', 'rss_esperados_ate_hoje', 'rss_total_previsto', 'unidades_em_dia', 'unidades_atrasadas'] },
  rss_ajustes: { operacao: 'ENTREGAS', porTurma: 'turma_id', ocultar: ['observacao', 'criado_por'] },
  // A monitora vê a rubrica (critérios e descritores) para indicar adequação, nunca notas, rascunhos ou evidências da professora.
  rubricas_avaliacao: { operacao: 'CONTRIBUICAO_AVALIATIVA', porTurma: 'turma_id', ocultar: ['motivo_alteracao', 'criado_por', 'aprovado_por'] },
  evidencias_avaliacao: { operacao: 'CONTRIBUICAO_AVALIATIVA', porTurma: 'turma_id',
    linha: (l, p) => l.origem === 'CONTRIBUICAO_MONITORA' && (l.responsavel ?? '').trim().toLowerCase() === p.email },
};
export const tabelaLegivelPor = (p: Perfil, tabela: string): boolean =>
  p.papel === 'PROFESSORA_ADMIN' || (tabela in LEITURA_MONITORA && (!LEITURA_MONITORA[tabela].operacao || p.operacoes.includes(LEITURA_MONITORA[tabela].operacao!)));

export interface ContextoLeitura { matriculas: Record<string, unknown>[]; grupos: Record<string, unknown>[] }
const col = (cab: string[], nome: string) => cab.findIndex(h => h.trim() === nome);

/** Recebe a tabela como a API do Sheets (primeira linha = cabeçalho) e devolve só o que o perfil pode ver. */
export function filtrarLeitura(tabela: string, valores: unknown[][], p: Perfil, ctx: ContextoLeitura): unknown[][] | null {
  if (!tabelaLegivelPor(p, tabela)) return null;
  if (p.papel === 'PROFESSORA_ADMIN' || !valores.length) return valores;
  const regra = LEITURA_MONITORA[tabela];
  const cab = valores[0].map(c => String(c ?? '').trim());
  const turmasOk = new Set(p.turmas);
  const matsOk = new Map<string, string>(); // matricula_id → aluno_id das turmas permitidas
  for (const m of ctx.matriculas) if (turmasOk.has(String(m.turma_id ?? '').trim())) matsOk.set(String(m.matricula_id ?? '').trim(), String(m.aluno_id ?? '').trim());
  const alunosOk = new Set(matsOk.values());
  const gruposOk = new Set(ctx.grupos.filter(g => turmasOk.has(String(g.turma_id ?? '').trim())).map(g => String(g.grupo_id ?? '').trim()));
  let linhas = valores.slice(1);
  if (!regra.todas && regra.porTurma) {
    const i = col(cab, regra.porTurma);
    if (i < 0) return [valores[0]]; // sem a coluna de vínculo não há como provar a turma: nada é liberado
    const ok = regra.porTurma === 'turma_id' ? turmasOk : regra.porTurma === 'matricula_id' ? new Set(matsOk.keys()) : regra.porTurma === 'aluno_id' ? alunosOk : gruposOk;
    linhas = linhas.filter(l => ok.has(String(l[i] ?? '').trim()));
  }
  if (regra.linha) linhas = linhas.filter(l => regra.linha!(Object.fromEntries(cab.map((c, i) => [c, String(l[i] ?? '')])), p));
  const ocultas = new Set((regra.ocultar ?? []).map(o => cab.indexOf(o)).filter(i => i >= 0));
  const permitidas = regra.somente ? new Set(regra.somente) : null;
  const manter = (_: unknown, i: number) => !ocultas.has(i) && (!permitidas || permitidas.has(cab[i]));
  return [cab.filter(manter), ...linhas.map(l => cab.map((_, i) => l[i] ?? '').filter(manter))];
}

/**
 * Contribuições da monitora em `evidencias_avaliacao`: sempre preliminares, de autoria dela, na turma delegada.
 * `registro` pode ser parcial (UPDATE); a decisão considera o estado resultante (existente + alterações).
 * A monitora não altera autoria, origem, turma nem o caráter preliminar, e não registra textos longos.
 */
export function validarContribuicaoMonitora(p: Perfil, registro: Record<string, unknown>, existente: Record<string, unknown> | null): Decisao {
  if (p.papel === 'PROFESSORA_ADMIN') return { ok: true };
  const final: Record<string, unknown> = { ...(existente ?? {}), ...registro };
  const s = (v: unknown) => String(v ?? '').trim();
  if (existente) {
    if (s(existente.origem) !== 'CONTRIBUICAO_MONITORA' || s(existente.responsavel).toLowerCase() !== p.email)
      return nega('OPERACAO_NAO_DELEGADA', 'Esta evidência não é uma contribuição sua.');
    for (const campo of ['origem', 'responsavel', 'preliminar', 'turma_id', 'matricula_id', 'periodo_id'])
      if (campo in registro && s(registro[campo]).toUpperCase() !== s(existente[campo]).toUpperCase())
        return nega('OPERACAO_NAO_DELEGADA', `O campo ${campo} da contribuição não pode ser alterado por monitora.`);
  }
  if (s(final.origem) !== 'CONTRIBUICAO_MONITORA') return nega('OPERACAO_NAO_DELEGADA', 'Monitoras registram apenas contribuições preliminares.');
  if (s(final.responsavel).toLowerCase() !== p.email) return nega('OPERACAO_NAO_DELEGADA', 'A autoria da contribuição deve ser da própria conta.');
  if (!['TRUE', '1', 'VERDADEIRO'].includes(s(final.preliminar).toUpperCase())) return nega('OPERACAO_NAO_DELEGADA', 'Contribuições de monitora são sempre preliminares.');
  if (s(final.observacao).length > 600) return nega('OPERACAO_NAO_DELEGADA', 'A contribuição deve ser objetiva (até 600 caracteres).');
  if (s(final.criterio_id) === '' && s(final.subcriterio_id) !== '') return nega('OPERACAO_NAO_DELEGADA', 'Informe o critério da contribuição.');
  return { ok: true };
}
