/**
 * Conversão entre as células da planilha e os objetos do app.
 *
 * A planilha é lida com valueRenderOption=UNFORMATTED_VALUE e dateTimeRenderOption=SERIAL_NUMBER:
 * datas chegam como número de série, sem depender da formatação de cada coluna
 * (a base mistura dd/mm/aaaa, m/d/aaaa e mm-dd-aa). Aqui elas viram AAAA-MM-DD.
 */

const DIA_MS = 86400000;
const EPOCA_PLANILHA = Date.UTC(1899, 11, 30);

const COLUNA_DATA_HORA = /^(data_hora|criado_em|atualizado_em|sincronizado_em|timestamp|resolvido_em)$/;
const COLUNA_DATA = /^(data|prazo)(_|$)|^(semana_inicio|semana_fim|inicio_atendimentos|fim_atendimentos)$/;
const COLUNA_HORA = /^hora(_|$)/;

export function semAcentos(texto: string): string {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Texto comparável: sem acento, minúsculo, espaços simples. */
export function textoComparavel(texto: unknown): string {
  return semAcentos(String(texto ?? '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Código comparável: sem acento, MAIÚSCULO, separado por _. Ex.: "A conferir" → "A_CONFERIR". */
export function codigoComparavel(texto: unknown): string {
  return semAcentos(String(texto ?? '')).toUpperCase().trim().replace(/[\s\-]+/g, '_');
}

export function serialParaData(serial: number): string {
  return new Date(EPOCA_PLANILHA + Math.floor(serial + 1e-9) * DIA_MS).toISOString().slice(0, 10);
}

/** Data e hora "locais" da planilha, sem fuso (o navegador interpreta como horário local). */
export function serialParaDataHora(serial: number): string {
  const segundos = Math.round(serial * 86400);
  return new Date(EPOCA_PLANILHA + segundos * 1000).toISOString().slice(0, 19);
}

/**
 * Normaliza datas para AAAA-MM-DD. Aceita ISO, dd/mm/aaaa (com ou sem hora, 1 ou 2 dígitos)
 * e número de série da planilha (com vírgula ou ponto decimal).
 */
export function normalizarDataAcademica(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return serialParaData(value);
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  if (/^\d{5}(?:[.,]\d+)?$/.test(raw)) return serialParaData(Number(raw.replace(',', '.')));
  return raw;
}

/** HH:MM a partir de "8:20", "08:20:00", "18h30" ou fração do dia (0,347). */
export function normalizarHora(value: unknown): string {
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const minutos = Math.round(value * 1440);
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  }
  const raw = String(value ?? '').trim();
  const m = /^(\d{1,2})\s*[:hH]\s*(\d{2})/.exec(raw);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : raw;
}

const DIAS: Record<string, number> = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 };

/** 0 = domingo … 6 = sábado. Aceita número, "TERCA", "Terça-feira", "ter". */
export function normalizarDiaSemana(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isInteger(n) && n >= 0 && n <= 7) return n % 7;
  const prefixo = codigoComparavel(value).replace(/[^A-Z]/g, '').slice(0, 3);
  return prefixo in DIAS ? DIAS[prefixo] : null;
}

function converterCelula(cabecalho: string, valor: unknown): unknown {
  if (valor === undefined || valor === null) return '';
  const h = cabecalho.toLowerCase();
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') {
    if (COLUNA_DATA_HORA.test(h)) return serialParaDataHora(valor);
    if (COLUNA_DATA.test(h)) return serialParaData(valor);
    if (COLUNA_HORA.test(h)) return normalizarHora(valor);
    return String(valor);
  }
  const texto = String(valor).trim();
  const upper = texto.toUpperCase();
  if (upper === 'TRUE' || upper === 'VERDADEIRO') return true;
  if (upper === 'FALSE' || upper === 'FALSO') return false;
  if (COLUNA_DATA.test(h)) return normalizarDataAcademica(texto);
  if (COLUNA_HORA.test(h)) return normalizarHora(texto);
  return texto;
}

/** Linhas da API (primeira = cabeçalho) → objetos. Linhas totalmente vazias são descartadas. */
export function parseSheetRowsToObjects<T = Record<string, any>>(rows: unknown[][]): T[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => String(h ?? '').trim());
  return rows
    .slice(1)
    .filter(row => Array.isArray(row) && row.some(v => v !== '' && v !== null && v !== undefined))
    .map(row => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const valor = converterCelula(h, row[i]);
        obj[h] = valor;
        const lower = h.toLowerCase();
        if (lower !== h && obj[lower] === undefined) obj[lower] = valor;
      });
      return obj as T;
    });
}

function lista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(v => String(v).trim()).filter(Boolean);
  return String(valor ?? '').split(/[;,]/).map(v => v.trim()).filter(Boolean);
}

function situacaoEntrega(status: unknown): 'ENTREGUE' | 'A_CONFERIR' | 'PENDENTE' | 'NAO_SE_APLICA' {
  const c = codigoComparavel(status);
  if (c === 'NAO_SE_APLICA' || c === 'N/A' || c === 'DISPENSADO') return 'NAO_SE_APLICA';
  if (c === 'A_CONFERIR' || c === 'EM_ANALISE' || c === 'AGUARDANDO_CONFERENCIA') return 'A_CONFERIR';
  if (c === 'ENTREGUE' || c === 'ENVIADO' || c === 'CONFERIDO' || c === 'VALIDADO') return 'ENTREGUE';
  return 'PENDENTE';
}

/**
 * Ajusta os cabeçalhos e valores reais de cada aba ao formato usado pelo app.
 * É idempotente: pode ser aplicada a linhas já normalizadas (ex.: cache antigo).
 */
const MESES: Record<string, string> = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
};

/** Data escrita à mão ("29/09 e 05/10/2026", "17–19/09/2026", "Set/2026") → última data reconhecível, ou ''. */
function dataDeTextoLivre(texto: string): string {
  const datas = [...texto.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
  const u = datas[datas.length - 1];
  if (u) return `${u[3]}-${u[2].padStart(2, '0')}-${u[1].padStart(2, '0')}`;
  const m = /([A-Za-z]{3})[A-Za-z]*\/(\d{4})/.exec(semAcentos(texto));
  const mes = m && MESES[m[1].toUpperCase()];
  return mes ? `${m![2]}-${mes}-01` : '';
}

/** "2026-10-14T01:30:00.000Z" (UTC, gravado por versões antigas) → "2026-10-13T22:30:00" (hora local). */
function utcParaLocal(valor: unknown): unknown {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(valor)) return valor;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function normalizarLinhasDaAba(tabela: string, rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map(item => {
    const r: Record<string, any> = { ...item };
    for (const k of Object.keys(r)) if (COLUNA_DATA_HORA.test(k)) r[k] = utcParaLocal(r[k]);
    switch (tabela) {
      case 'periodos':
      case 'turmas':
      case 'matriculas':
      case 'alunos':
        r.status = codigoComparavel(r.status) === 'ATIVA' ? 'ATIVO' : codigoComparavel(r.status) || r.status;
        if (tabela === 'periodos') {
          r.data_inicio = normalizarDataAcademica(r.data_inicio);
          r.data_fim = normalizarDataAcademica(r.data_fim);
        }
        if (tabela === 'alunos') r.identificador_academico = String(r.identificador_academico ?? '');
        break;
      case 'horarios_turma':
        r.dia_semana = normalizarDiaSemana(r.dia_semana);
        r.hora_inicio = normalizarHora(r.hora_inicio);
        r.hora_fim = normalizarHora(r.hora_fim);
        r.data_inicio = normalizarDataAcademica(r.data_inicio);
        r.data_fim = normalizarDataAcademica(r.data_fim);
        r.ativo = r.ativo === '' || r.ativo === undefined ? true : r.ativo === true;
        break;
      case 'turmas_origem':
        r.ativo = r.ativo === '' || r.ativo === undefined ? true : r.ativo === true;
        break;
      case 'entregas':
        r.tipo_documento = r.tipo_documento || r.tipo_entrega || r.codigo_entrega || '';
        r.status_entrega = r.status_entrega ?? r.status ?? '';
        r.data_entrega = normalizarDataAcademica(r.data_entrega || r.data_envio || '');
        r.situacao = situacaoEntrega(r.status ?? r.status_entrega);
        break;
      case 'feedbacks': {
        // `data` é o dia do registro (importações trazem "03/09/2026"); `criado_em` pode ser o dia da importação.
        const original = String(r.data ?? '').trim();
        let data = normalizarDataAcademica(r.data);
        if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
          r.data_texto = original;
          data = dataDeTextoLivre(original);
        }
        const criado = String(r.criado_em ?? '');
        r.data = data;
        r.data_hora = r.data_hora || (r.data_texto || (data && !criado.startsWith(data)) ? data : criado || data) || '';
        break;
      }
      case 'ocorrencias':
        if (typeof r.data_hora === 'number') r.data_hora = serialParaDataHora(r.data_hora);
        else if (r.data_hora && !/^\d{4}-\d{2}-\d{2}/.test(String(r.data_hora))) {
          // Texto livre ("17-18/09/2026", "29/09 e 05/10/2026"): ordena pela última data e mostra o texto original.
          const original = String(r.data_hora).trim();
          const data = normalizarDataAcademica(original);
          if (/^\d{4}-\d{2}-\d{2}$/.test(data)) r.data_hora = data;
          else {
            r.data_hora = dataDeTextoLivre(original);
            r.data_texto = original;
          }
        }
        break;
      case 'grupo_integrantes':
        r.grupo_integrante_id = r.grupo_integrante_id || r.integrante_id || '';
        r.integrante_id = r.grupo_integrante_id;
        break;
      case 'leituras_responsaveis':
        r.leitura_agenda_id = r.leitura_agenda_id || r.leitura_id || '';
        r.leitura_id = r.leitura_agenda_id;
        r.data = normalizarDataAcademica(r.data || r.data_discussao || '');
        r.tema = r.tema || r.titulo || r.artigo_leitura || '';
        r.responsavel_nome = r.responsavel_nome || r.responsaveis_texto || '';
        r.status_realizacao = codigoComparavel(r.status_realizacao) || '';
        r.responsaveis_efetivos = lista(r.responsaveis_efetivos);
        break;
      case 'registros_semanais':
        // semana_rss é a semana acadêmica; encontro_numero é a sessão clínica.
        r.semana = r.semana ?? r.semana_rss ?? '';
        r.observacao = r.observacao ?? r.limitacoes ?? '';
        r.data_entrega = normalizarDataAcademica(r.data_entrega);
        break;
      case 'calendario_rss':
        r.semana_inicio = normalizarDataAcademica(r.semana_inicio);
        r.semana_fim = normalizarDataAcademica(r.semana_fim);
        break;
      case 'regras_rss':
        r.regra_id = r.regra_id ?? r.regra_rss_id ?? '';
        r.total_esperado = r.total_esperado ?? r.total_previsto ?? '';
        break;
      case 'marcos_academicos':
        r.data_prazo = normalizarDataAcademica(r.data_prazo);
        r.status = codigoComparavel(r.status) || 'PENDENTE';
        break;
      case 'frequencias':
        r.data_aula = normalizarDataAcademica(r.data_aula);
        for (const k of ['atraso', 'celular', 'conversa', 'saiu_cedo', 'participou']) r[k] = r[k] === true;
        r.apresentacao = codigoComparavel(r.apresentacao) || '';
        break;
      case 'encontros_turma':
        r.data = normalizarDataAcademica(r.data);
        r.status = codigoComparavel(r.status) || 'PREVISTO';
        r.chamada_salva = r.chamada_salva === true;
        break;
      case 'avaliacoes_completas':
        if (!Array.isArray(r.notas_criterios)) {
          try { r.notas_criterios = r.notas_criterios_json ? JSON.parse(r.notas_criterios_json) : []; }
          catch { r.notas_criterios = []; }
        }
        r.nota_final = Number(r.nota_final) || 0;
        r.nota_maxima = Number(r.nota_maxima) || 0;
        break;
      case 'tarefas_professora':
        r.id = r.id || r.tarefa_id;
        r.duracao_minutos = Number(r.duracao_minutos) || 15;
        break;
    }
    return r;
  });
}

/** Valor do app → texto gravado (RAW). Listas viram "a; b", objetos viram JSON. */
export function serializarValor(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'boolean') return valor ? 'TRUE' : 'FALSE';
  if (Array.isArray(valor)) return valor.join('; ');
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/** Valor enviado à planilha: número segue como número (fórmulas e somas funcionam); o resto vai como texto. */
export function valorParaPlanilha(valor: unknown): string | number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : '';
  return serializarValor(valor);
}

/** Objeto do app → nomes de colunas reais da aba. */
export function adaptarParaPlanilha(tabela: string, registro: Record<string, any>): Record<string, any> {
  const a: Record<string, any> = { ...registro };
  if (tabela === 'entregas') {
    a.tipo_entrega = registro.tipo_entrega ?? registro.tipo_documento;
    a.status = registro.status ?? registro.status_entrega;
    a.data_envio = registro.data_envio ?? registro.data_entrega;
  } else if (tabela === 'feedbacks') {
    a.data = registro.data ?? String(registro.data_hora ?? '').slice(0, 10);
  } else if (tabela === 'leituras_responsaveis') {
    a.leitura_agenda_id = registro.leitura_agenda_id ?? registro.leitura_id;
  } else if (tabela === 'grupo_integrantes') {
    a.grupo_integrante_id = registro.grupo_integrante_id ?? registro.integrante_id;
  } else if (tabela === 'avaliacoes_completas') {
    a.notas_criterios_json = JSON.stringify(registro.notas_criterios ?? []);
  } else if (tabela === 'tarefas_professora') {
    a.tarefa_id = registro.tarefa_id ?? registro.id;
  } else if (tabela === 'horarios_turma' && typeof registro.dia_semana === 'number') {
    // A planilha guarda o dia como número (0 = domingo … 6 = sábado) e o nome em dia_semana_rotulo.
    a.dia_semana_rotulo = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'][registro.dia_semana] ?? '';
  }
  return a;
}

/** Índice de coluna (0 = A) → letra(s) da coluna. */
export function letraColuna(indice: number): string {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
