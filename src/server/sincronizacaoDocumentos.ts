/**
 * Sincronização de METADADOS de documentos do Drive → aba monitoramento_documentos.
 *
 * Limites deliberados (PRD/adendo §5–6):
 *  - consulta só id, data de modificação, lixeira e pastas-mãe; NUNCA nome, conteúdo, revisões ou links;
 *  - só ATUALIZA linhas já cadastradas (não cria linhas, não deduz titular por nome de arquivo);
 *  - só escreve 4 colunas: data_modificacao_drive, consultado_em, status, erro_codigo;
 *    validacao_manual, observações e qualquer outra coluna ficam intactas;
 *  - "recente" = modificado na janela (padrão 7 dias): NÃO significa entrega, versão correta ou qualidade;
 *  - permissão negada (SEM_PERMISSAO) é diferente de arquivo ausente (NAO_ENCONTRADO_NA_PASTA).
 */
export const ABA_MONITORAMENTO = 'monitoramento_documentos';
export const CRONS_SINCRONIZACAO = ['0 11 * * *', '0 21 * * *'] as const; // 08:00 e 18:00 em Brasília (UTC-3, sem horário de verão)
export const HORARIOS_BRASILIA: Record<string, string> = { '0 11 * * *': '08:00', '0 21 * * *': '18:00' };
export const JANELA_PADRAO_DIAS = 7;
export const COLUNAS_ESCRITAS = ['data_modificacao_drive', 'consultado_em', 'status', 'erro_codigo'] as const;

export type StatusDocumento = 'LOCALIZADO_RECENTE' | 'LOCALIZADO_ANTIGO' | 'NAO_ENCONTRADO_NA_PASTA' | 'SEM_PERMISSAO' | 'NAO_VERIFICADO' | 'A_CONFERIR';
export interface DepsSincronizacao {
  planilhaId: string; sheetsBase: string; driveBase: string;
  tokenSheets: string; tokenDrive: string; agora: Date; janelaDias?: number; buscar?: typeof fetch;
}
export interface ResultadoSincronizacao {
  status: 'SUCESSO' | 'PARCIAL' | 'FALHA';
  modo: 'MANUAL' | 'AGENDADO'; cron?: string; inicio: string; fim: string; janelaDias: number;
  lidos: number; consultados: number; atualizados: number;
  erros: Record<string, number>; mensagem?: string;
}
const colName = (i: number) => { let n = i + 1, o = ''; while (n > 0) { n--; o = String.fromCharCode(65 + n % 26) + o; n = Math.floor(n / 26); } return o; };
const q = (n: string) => `'${n.replaceAll("'", "''")}'`;

export function classificarDocumento(
  resposta: { status: number; corpo?: { modifiedTime?: string; trashed?: boolean; parents?: string[] } },
  pastaEsperada: string, agora: Date, janelaDias: number,
): { status: StatusDocumento | null; modificado?: string; erro: string; transitorio: boolean } {
  const s = resposta.status;
  if (s === 404) return { status: 'NAO_ENCONTRADO_NA_PASTA', erro: 'DRIVE_404', transitorio: false };
  if (s === 403) return { status: 'SEM_PERMISSAO', erro: 'DRIVE_403', transitorio: false };
  if (s !== 200) return { status: null, erro: s === 0 ? 'REDE' : `DRIVE_${s}`, transitorio: true };
  const c = resposta.corpo ?? {};
  if (c.trashed) return { status: 'NAO_ENCONTRADO_NA_PASTA', modificado: c.modifiedTime, erro: 'LIXEIRA', transitorio: false };
  if (pastaEsperada && Array.isArray(c.parents) && c.parents.length && !c.parents.includes(pastaEsperada))
    return { status: 'NAO_ENCONTRADO_NA_PASTA', modificado: c.modifiedTime, erro: 'FORA_DA_PASTA', transitorio: false };
  const t = c.modifiedTime ? Date.parse(c.modifiedTime) : NaN;
  if (!Number.isFinite(t)) return { status: 'A_CONFERIR', erro: 'SEM_DATA', transitorio: false };
  const recente = agora.getTime() - t <= janelaDias * 86_400_000;
  return { status: recente ? 'LOCALIZADO_RECENTE' : 'LOCALIZADO_ANTIGO', modificado: c.modifiedTime, erro: '', transitorio: false };
}

export class FalhaDeSincronizacao extends Error {
  constructor(public readonly codigo: string, message: string) { super(message); }
}

export async function sincronizarDocumentos(d: DepsSincronizacao, modo: 'MANUAL' | 'AGENDADO', cron?: string): Promise<{ resultado: ResultadoSincronizacao; linhaHistorico: string[] }> {
  const buscar = d.buscar ?? fetch, janela = d.janelaDias ?? JANELA_PADRAO_DIAS, inicio = d.agora.toISOString();
  const base = d.sheetsBase + d.planilhaId, hdrS = { Authorization: 'Bearer ' + d.tokenSheets };
  const erros: Record<string, number> = {};
  const conta = (c: string) => { erros[c] = (erros[c] ?? 0) + 1; };
  const encerrar = (status: ResultadoSincronizacao['status'], x: Partial<ResultadoSincronizacao> = {}) => {
    const fim = new Date().toISOString();
    const resultado: ResultadoSincronizacao = { status, modo, cron, inicio, fim, janelaDias: janela, lidos: 0, consultados: 0, atualizados: 0, erros, ...x };
    const resumoErros = Object.entries(erros).map(([c, n]) => `${c}×${n}`).join(', ');
    return { resultado, linhaHistorico: ['DRIVE_METADADOS', '', ABA_MONITORAMENTO, modo, status === 'FALHA' ? 'FALHA' : 'OK',
      `inicio=${inicio};fim=${fim};janela=${janela}d${cron ? ';cron=' + cron : ''}`, status, String(resultado.lidos), String(resultado.atualizados), (resumoErros || resultado.mensagem || '').slice(0, 300)] };
  };

  // 1) lê a aba
  let rows: unknown[][];
  try {
    const r = await buscar(`${base}/values/${encodeURIComponent(q(ABA_MONITORAMENTO) + '!A1:ZZ')}`, { headers: hdrS, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { conta(r.status === 400 ? 'ABA_AUSENTE' : `SHEETS_${r.status}`); return encerrar('FALHA', { mensagem: r.status === 400 ? 'Aba monitoramento_documentos não encontrada.' : `Planilha respondeu ${r.status}.` }); }
    rows = ((await r.json()) as { values?: unknown[][] }).values ?? [];
  } catch { conta('REDE_SHEETS'); return encerrar('FALHA', { mensagem: 'Sem conexão com a planilha.' }); }
  const cab = (rows[0] ?? []).map(c => String(c ?? '').trim());
  const idx = (n: string) => cab.indexOf(n);
  if (idx('arquivo_id') < 0 || COLUNAS_ESCRITAS.every(c => idx(c) < 0)) { conta('CABECALHO_INCOMPATIVEL'); return encerrar('FALHA', { mensagem: 'Cabeçalho sem arquivo_id ou sem colunas de status.' }); }

  // 2) uma consulta por arquivo distinto (documento coletivo ligado a vários integrantes = 1 consulta)
  const alvos = rows.slice(1).map((r, i) => ({ linha: i + 2, r })).filter(x => String(x.r[idx('arquivo_id')] ?? '').trim() !== '');
  const ids = [...new Set(alvos.map(x => String(x.r[idx('arquivo_id')]).trim()))];
  const respostas = new Map<string, { status: number; corpo?: any }>();
  let fatal = false;
  for (let i = 0; i < ids.length && !fatal; i += 5) {
    await Promise.all(ids.slice(i, i + 5).map(async id => {
      try {
        const r = await buscar(`${d.driveBase}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent('id,modifiedTime,trashed,parents')}&supportsAllDrives=true`,
          { headers: { Authorization: 'Bearer ' + d.tokenDrive }, signal: AbortSignal.timeout(15000) });
        if (r.status === 401) { fatal = true; return; }
        respostas.set(id, { status: r.status, corpo: r.status === 200 ? await r.json() : undefined });
      } catch { respostas.set(id, { status: 0 }); }
    }));
  }
  if (fatal) { conta('TOKEN_DRIVE_RECUSADO'); return encerrar('FALHA', { lidos: alvos.length, mensagem: 'O Drive recusou a conta de serviço (401).' }); }

  // 3) monta somente as células que mudam
  const dados: { range: string; values: unknown[][] }[] = [];
  let atualizados = 0;
  for (const { linha, r } of alvos) {
    const id = String(r[idx('arquivo_id')]).trim();
    const c = classificarDocumento(respostas.get(id) ?? { status: 0 }, String(r[idx('pasta_id')] ?? '').trim(), d.agora, janela);
    if (c.erro) conta(c.erro);
    const novo: Record<string, string> = { consultado_em: inicio, erro_codigo: c.erro };
    if (c.transitorio) { if (!String(r[idx('status')] ?? '').trim()) novo.status = 'NAO_VERIFICADO'; delete novo.consultado_em; }
    else { novo.status = c.status!; if (c.modificado) novo.data_modificacao_drive = c.modificado; }
    let mudou = false;
    for (const col of COLUNAS_ESCRITAS) {
      const i = idx(col); if (i < 0 || !(col in novo)) continue;
      const atual = String(r[i] ?? '');
      if (col === 'consultado_em' || atual !== novo[col]) { dados.push({ range: `${q(ABA_MONITORAMENTO)}!${colName(i)}${linha}`, values: [[novo[col]]] }); if (col !== 'consultado_em') mudou = true; }
    }
    if (mudou) atualizados++;
  }
  try {
    if (dados.length) {
      const w = await buscar(`${base}/values:batchUpdate`, { method: 'POST', headers: { ...hdrS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: dados }), signal: AbortSignal.timeout(20000) });
      if (!w.ok) { conta(`SHEETS_ESCRITA_${w.status}`); return encerrar('FALHA', { lidos: alvos.length, consultados: respostas.size, mensagem: `Não foi possível gravar na planilha (${w.status}).` }); }
    }
  } catch { conta('REDE_SHEETS'); return encerrar('FALHA', { lidos: alvos.length, consultados: respostas.size, mensagem: 'Sem conexão ao gravar na planilha.' }); }
  // Documento ausente/sem permissão é RESULTADO da consulta (fica no status); só falha técnica torna a execução PARCIAL.
  const ACHADOS = ['DRIVE_404', 'DRIVE_403', 'LIXEIRA', 'FORA_DA_PASTA', 'SEM_DATA'];
  const tecnico = Object.keys(erros).some(c => !ACHADOS.includes(c));
  return encerrar(tecnico ? 'PARCIAL' : 'SUCESSO', { lidos: alvos.length, consultados: respostas.size, atualizados });
}
