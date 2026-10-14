/**
 * Backup da Central: arquivo JSON com contagens e checksum, conferência de integridade e
 * comparação com os dados atuais para restaurar REGISTROS individuais (nunca em massa).
 * Funções puras; a gravação da restauração usa o mesmo caminho das demais (fila + coordenador + log).
 */
import { PRIMARY_KEYS, recordIdentity } from './recordIdentity';
import { TABELAS_AUTORIZADAS_ESCRITA } from './safeWriteService';
import { valorComparavel } from '../server/coordenacaoCritica';

export const VERSAO_BACKUP = '2.0';
export type TabelasBackup = Record<string, Record<string, unknown>[]>;
export interface ArquivoBackup {
  exportDate: string;
  version: string;
  contagens: Record<string, number>;
  checksum: string;
  tables: TabelasBackup;
}

/** Abas geradas por fórmula na planilha: nunca restauradas pelo aplicativo. */
const NAO_RESTAURAVEIS = new Set(['registros_semanais']);
export const TABELAS_RESTAURAVEIS = TABELAS_AUTORIZADAS_ESCRITA.filter(t => !NAO_RESTAURAVEIS.has(t));

/** Serialização estável (chaves ordenadas) para que o checksum não dependa da ordem dos campos. */
function estavel(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + estavel(o[k])).join(',') + '}';
  }
  return JSON.stringify(v ?? null);
}
export async function checksumDeTabelas(tables: TabelasBackup): Promise<string> {
  const dados = new TextEncoder().encode(estavel(tables));
  const hash = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function gerarBackup(tables: TabelasBackup, agora = new Date()): Promise<ArquivoBackup> {
  return {
    exportDate: agora.toISOString(), version: VERSAO_BACKUP,
    contagens: Object.fromEntries(Object.entries(tables).map(([t, r]) => [t, r.length])),
    checksum: await checksumDeTabelas(tables), tables,
  };
}

export interface RelatorioBackup {
  ok: boolean;
  erros: string[];
  avisos: string[];
  contagens: Record<string, number>;
}
const REFERENCIAS: { tabela: string; campo: string; para: string }[] = [
  { tabela: 'matriculas', campo: 'aluno_id', para: 'alunos' },
  { tabela: 'matriculas', campo: 'turma_id', para: 'turmas' },
  { tabela: 'frequencias', campo: 'matricula_id', para: 'matriculas' },
  { tabela: 'entregas', campo: 'matricula_id', para: 'matriculas' },
  { tabela: 'ocorrencias', campo: 'matricula_id', para: 'matriculas' },
  { tabela: 'orientacoes', campo: 'matricula_id', para: 'matriculas' },
  { tabela: 'avaliacoes', campo: 'matricula_id', para: 'matriculas' },
  { tabela: 'horarios_turma', campo: 'turma_id', para: 'turmas' },
  { tabela: 'encontros_turma', campo: 'turma_id', para: 'turmas' },
];

/** Confere estrutura, checksum, chaves duplicadas e referências. Não altera nada. */
export async function validarBackup(bruto: unknown): Promise<RelatorioBackup> {
  const erros: string[] = [], avisos: string[] = [];
  const b = bruto as Partial<ArquivoBackup> | null;
  if (!b || typeof b !== 'object' || !b.tables || typeof b.tables !== 'object')
    return { ok: false, erros: ['Arquivo não é um backup da Central (sem tabelas).'], avisos, contagens: {} };
  const contagens = Object.fromEntries(Object.entries(b.tables).map(([t, r]) => [t, Array.isArray(r) ? r.length : -1]));
  for (const [t, n] of Object.entries(contagens)) if (n < 0) erros.push(`Tabela ${t} não é uma lista.`);
  if (b.version === VERSAO_BACKUP) {
    if (!b.checksum) erros.push('Backup sem checksum.');
    else if (await checksumDeTabelas(b.tables as TabelasBackup) !== b.checksum)
      erros.push('O conteúdo não confere com o checksum: o arquivo foi alterado ou está corrompido.');
    for (const [t, n] of Object.entries(b.contagens ?? {}))
      if (contagens[t] !== n) erros.push(`Tabela ${t}: contagem declarada ${n}, encontrada ${contagens[t] ?? 0}.`);
  } else avisos.push(`Backup de versão ${b.version ?? 'desconhecida'} (anterior ao checksum): conteúdo não verificável.`);

  const chaves: Record<string, Set<string>> = {};
  for (const [t, rows] of Object.entries(b.tables as TabelasBackup)) {
    if (!Array.isArray(rows) || !PRIMARY_KEYS[t]) continue;
    const vistos = new Set<string>(); let dup = 0, semChave = 0;
    for (const r of rows) {
      try { const id = recordIdentity(t, r); if (vistos.has(id)) dup++; vistos.add(id); } catch { semChave++; }
    }
    chaves[t] = vistos;
    if (dup) erros.push(`Tabela ${t}: ${dup} chave(s) duplicada(s).`);
    if (semChave) avisos.push(`Tabela ${t}: ${semChave} linha(s) sem chave.`);
  }
  for (const ref of REFERENCIAS) {
    const rows = (b.tables as TabelasBackup)[ref.tabela], alvo = chaves[ref.para];
    if (!Array.isArray(rows) || !alvo) continue;
    const orfaos = rows.filter(r => { const v = String(r[ref.campo] ?? '').trim(); return v && !alvo.has(v); }).length;
    if (orfaos) avisos.push(`${ref.tabela}: ${orfaos} registro(s) apontam para ${ref.para} que não existe no backup (${ref.campo}).`);
  }
  return { ok: erros.length === 0, erros, avisos, contagens };
}

export interface DiferencaRegistro {
  tabela: string;
  id: string;
  tipo: 'AUSENTE_NO_ATUAL' | 'DIFERENTE';
  campos: string[];       // campos que diferem (nomes apenas; valores não são exibidos)
  registroBackup: Record<string, unknown>;
  registroAtual: Record<string, unknown> | null;
}
const IGNORAR = new Set(['atualizado_em', 'criado_em', 'sincronizado_em']);

/**
 * O que mudou desde o backup, só nas tabelas restauráveis. Registros que existem hoje e não existiam
 * no backup NÃO são listados para exclusão: restaurar nunca apaga trabalho novo.
 */
export function compararComBackup(backup: TabelasBackup, atual: TabelasBackup): DiferencaRegistro[] {
  const saida: DiferencaRegistro[] = [];
  for (const tabela of TABELAS_RESTAURAVEIS) {
    const antigos = backup[tabela], hoje = atual[tabela];
    if (!Array.isArray(antigos) || !PRIMARY_KEYS[tabela]) continue;
    const mapaHoje = new Map<string, Record<string, unknown>>();
    for (const r of hoje ?? []) { try { mapaHoje.set(recordIdentity(tabela, r), r); } catch { /* sem chave */ } }
    for (const antigo of antigos) {
      let id: string;
      try { id = recordIdentity(tabela, antigo); } catch { continue; }
      const agora = mapaHoje.get(id);
      if (!agora) { saida.push({ tabela, id, tipo: 'AUSENTE_NO_ATUAL', campos: [], registroBackup: antigo, registroAtual: null }); continue; }
      const campos = Object.keys(antigo).filter(k => !IGNORAR.has(k) && valorComparavel(antigo[k]) !== valorComparavel(agora[k]) &&
        !(valorComparavel(antigo[k]) === '' && agora[k] === undefined));
      if (campos.length) saida.push({ tabela, id, tipo: 'DIFERENTE', campos, registroBackup: antigo, registroAtual: agora });
    }
  }
  return saida;
}

/** Operação de gravação para restaurar um registro: INSERT se sumiu; UPDATE só dos campos que diferem. */
export function operacaoDeRestauracao(d: DiferencaRegistro): { tipo: 'INSERT' | 'UPDATE'; registro: Record<string, unknown> } {
  if (d.tipo === 'AUSENTE_NO_ATUAL') return { tipo: 'INSERT', registro: { ...d.registroBackup } };
  const chave = PRIMARY_KEYS[d.tabela];
  const registro: Record<string, unknown> = { [chave]: d.registroBackup[chave] };
  if (d.tabela === 'frequencias') { registro.matricula_id = d.registroBackup.matricula_id; registro.data_aula = d.registroBackup.data_aula; }
  for (const c of d.campos) registro[c] = d.registroBackup[c];
  return { tipo: 'UPDATE', registro };
}
