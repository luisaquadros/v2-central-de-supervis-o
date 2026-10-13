/**
 * Preparar aula a partir do RSS recente da turma.
 * Só organiza e destaca o que os estudantes escreveram; não inventa conteúdo clínico.
 * Os "temas" são termos recorrentes (contagem por relato), sempre com a contagem à vista
 * para a professora julgar. Função pura: sem acesso a planilha, relógio ou tela.
 */
import type { RegistroSemanal } from '../types';

export interface UnidadeRssRef { unidadeId: string; tipo: 'INDIVIDUAL' | 'GRUPO'; nome: string }

export interface ItemRss {
  registroId: string;
  unidade: string;
  texto: string;
  data: string;
  emRevisao: boolean;
}

export interface TermoRecorrente { termo: string; relatos: number; unidades: number }

export interface SugestoesRss {
  de: string;
  ate: string;
  totalRelatos: number;
  unidadesComRelato: number;
  unidadesSemRelato: string[];
  prioritarios: ItemRss[];
  duvidas: ItemRss[];
  limitacoes: ItemRss[];
  termos: TermoRecorrente[];
  ligacaoComLeitura: { tema: string; termos: string[] } | null;
  sugestoes: string[];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const comparavel = (t: unknown) => semAcento(String(t ?? '')).toLowerCase().trim();

/** Respostas vazias de formulário ("não", "nenhuma", "sem dúvidas", "-") não contam como relato. */
export function textoSignificativo(valor: unknown): boolean {
  const t = comparavel(valor).replace(/[.!\s]+$/g, '');
  if (t.length < 6) return false;
  if (/^(n\/?a|nao|nada|nenhum[a]?|sem\b[^,;]{0,25}|nao (ha|houve|tenho|possuo|se aplica)\b[^,;]{0,25}|-+|\.+)$/.test(t)) return false;
  return true;
}

const SOMAR_DIAS = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const STOP = new Set((
  'para como mais mas com sem uma umas uns dos das nos nas pelo pela pelos pelas que quando onde porque entre sobre ' +
  'ainda tambem muito muita muitos muitas pouco pouca isso essa esse esta este estao estava foram foi ser sao tem ter ' +
  'tinha tive tivemos vez vezes fazer fez feito fica ficou pode podem poderia acho acredito precisa precisamos gostaria ' +
  'durante depois antes apos cada outro outra outros outras algum alguma alguns algumas nao sim ja so nos eles elas ' +
  'dele dela deles delas seu sua seus suas meu minha nosso nossa aqui ali la nada tudo todo toda todos todas bem ' +
  'paciente pacientes atendimento atendimentos sessao sessoes supervisao encontro encontros semana semanas ' +
  'estagio caso casos grupo estudante aluno aluna dificuldade duvida duvidas questao questoes pontos ponto tema temas'
).split(/\s+/));

function tokens(texto: string): string[] {
  return comparavel(texto).split(/[^a-z0-9]+/).filter(t => t.length >= 5 && !STOP.has(t) && !/^\d+$/.test(t));
}

const campo = (r: RegistroSemanal, k: string) => String((r as unknown as Record<string, unknown>)[k] ?? '').trim();

export function gerarSugestoesRss(params: {
  turmaId: string;
  registros: RegistroSemanal[];
  unidades: UnidadeRssRef[];
  nomeDe: (registro: RegistroSemanal) => string;
  hojeIso: string;
  dias?: number;
  temaLeitura?: string;
}): SugestoesRss {
  const { turmaId, registros, unidades, nomeDe, hojeIso, dias = 14, temaLeitura } = params;
  const de = SOMAR_DIAS(hojeIso, -dias);
  const recentes = registros.filter(r => {
    const rt = campo(r, 'turma_id');
    const data = campo(r, 'data_entrega').slice(0, 10);
    return (!rt || rt === turmaId) && /^\d{4}-\d{2}-\d{2}$/.test(data) && data >= de && data <= hojeIso;
  });

  const revisao = (r: RegistroSemanal) => campo(r, 'status_revisao').toUpperCase() === 'PENDENTE_REVISAO';
  const item = (r: RegistroSemanal, texto: string): ItemRss => ({
    registroId: String(r.registro_id), unidade: nomeDe(r), texto, data: campo(r, 'data_entrega').slice(0, 10), emRevisao: revisao(r),
  });
  const porData = (a: ItemRss, b: ItemRss) => b.data.localeCompare(a.data) || a.unidade.localeCompare(b.unidade, 'pt-BR');
  const coletar = (k: string) => recentes.filter(r => textoSignificativo(campo(r, k))).map(r => item(r, campo(r, k))).sort(porData);

  const prioritarios = coletar('prioridade_supervisao');
  const duvidas = coletar('duvidas_supervisao');
  const limitacoes = coletar('limitacoes');

  // Unidades que relataram no período (grupo ou matrícula).
  const chaveDe = (r: RegistroSemanal) => campo(r, 'grupo_id') || campo(r, 'matricula_id');
  const comRelato = new Set(recentes.map(chaveDe).filter(Boolean));
  const unidadesSemRelato = unidades.filter(u => !comRelato.has(u.unidadeId)).map(u => u.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Termos recorrentes: conta por RELATO (não por repetição dentro do mesmo texto).
  const contagem = new Map<string, { relatos: Set<string>; unidades: Set<string>; formas: Map<string, number> }>();
  for (const r of recentes) {
    const texto = ['prioridade_supervisao', 'duvidas_supervisao', 'limitacoes', 'proximo_passo']
      .map(k => campo(r, k)).filter(textoSignificativo).join(' . ');
    const originais = new Map<string, string>();
    for (const bruto of texto.split(/[^\p{L}\p{N}]+/u)) originais.set(comparavel(bruto), bruto.toLowerCase());
    for (const t of new Set(tokens(texto))) {
      const c = contagem.get(t) ?? { relatos: new Set(), unidades: new Set(), formas: new Map() };
      c.relatos.add(String(r.registro_id));
      c.unidades.add(chaveDe(r) || String(r.registro_id));
      const forma = originais.get(t) ?? t;
      c.formas.set(forma, (c.formas.get(forma) ?? 0) + 1);
      contagem.set(t, c);
    }
  }
  const termos: TermoRecorrente[] = [...contagem.entries()]
    .filter(([, c]) => c.unidades.size >= 2)
    .map(([t, c]) => ({ termo: [...c.formas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? t, relatos: c.relatos.size, unidades: c.unidades.size }))
    .sort((a, b) => b.unidades - a.unidades || b.relatos - a.relatos || a.termo.localeCompare(b.termo, 'pt-BR'))
    .slice(0, 8);

  let ligacaoComLeitura: SugestoesRss['ligacaoComLeitura'] = null;
  if (temaLeitura) {
    const doTema = new Set(tokens(temaLeitura));
    const comuns = termos.filter(t => doTema.has(comparavel(t.termo))).map(t => t.termo);
    // Também considera termos do relato (não só os 8 do topo) que aparecem no título da leitura.
    for (const [t, c] of contagem) if (doTema.has(t) && !comuns.some(x => comparavel(x) === t)) comuns.push([...c.formas.keys()][0] ?? t);
    if (comuns.length) ligacaoComLeitura = { tema: temaLeitura, termos: comuns.slice(0, 5) };
  }

  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  const sugestoes: string[] = [];
  if (prioritarios.length) sugestoes.push(`Abrir pelos relatos marcados como prioridade de supervisão (${plural(new Set(prioritarios.map(p => p.unidade)).size, 'unidade', 'unidades')}).`);
  for (const t of termos.slice(0, 3)) sugestoes.push(`Propor discussão sobre “${t.termo}”: citado por ${plural(t.unidades, 'unidade', 'unidades')} (${plural(t.relatos, 'relato', 'relatos')}).`);
  if (ligacaoComLeitura) sugestoes.push(`Conectar a leitura “${ligacaoComLeitura.tema}” ao que apareceu nos relatos: ${ligacaoComLeitura.termos.join(', ')}.`);
  if (duvidas.length && !prioritarios.length) sugestoes.push(`Reservar tempo para ${plural(duvidas.length, 'dúvida relatada', 'dúvidas relatadas')}.`);
  if (limitacoes.length) sugestoes.push(`Rever limitações de campo relatadas (${plural(limitacoes.length, 'relato', 'relatos')}): materiais, instituição ou participantes.`);
  if (unidadesSemRelato.length) sugestoes.push(`Perguntar sobre ${plural(unidadesSemRelato.length, 'unidade', 'unidades')} sem RSS nos últimos ${dias} dias.`);

  return {
    de, ate: hojeIso, totalRelatos: recentes.length, unidadesComRelato: comRelato.size, unidadesSemRelato,
    prioritarios, duvidas, limitacoes, termos, ligacaoComLeitura, sugestoes,
  };
}

export interface ResumoSemEnvio {
  dias: number;
  de: string;
  ate: string;
  totalUnidades: number;
  semEnvio: number;
  tipo: 'GRUPO' | 'INDIVIDUAL';
  nomes: string[];
  texto: string;
}

/**
 * Resumo de quem NÃO enviou RSS na janela (padrão 7 dias), por turma — em vez de um aviso por estudante.
 * Grupo (Clínica Ampliada) ou estudante é a unidade. Respostas "em revisão" contam como enviadas.
 * Devolve null quando não há unidades ou a prática da turma não está em andamento.
 */
export function resumirSemEnvioRss(params: {
  turmaId: string;
  registros: RegistroSemanal[];
  unidades: UnidadeRssRef[];
  hojeIso: string;
  praticaAtiva: boolean;
  dias?: number;
}): ResumoSemEnvio | null {
  const { turmaId, registros, unidades, hojeIso, praticaAtiva, dias = 7 } = params;
  if (!praticaAtiva || unidades.length === 0) return null;
  const de = SOMAR_DIAS(hojeIso, -dias);
  const enviaram = new Set<string>();
  for (const r of registros) {
    const rt = campo(r, 'turma_id');
    const data = campo(r, 'data_entrega').slice(0, 10);
    if ((rt && rt !== turmaId) || !/^\d{4}-\d{2}-\d{2}$/.test(data) || data < de || data > hojeIso) continue;
    const chave = campo(r, 'grupo_id') || campo(r, 'matricula_id');
    if (chave) enviaram.add(chave);
  }
  const faltam = unidades.filter(u => !enviaram.has(u.unidadeId));
  const tipo: 'GRUPO' | 'INDIVIDUAL' = unidades.some(u => u.tipo === 'GRUPO') ? 'GRUPO' : 'INDIVIDUAL';
  const n = faltam.length;
  const periodo = `nos últimos ${dias} dias`;
  const texto = n === 0
    ? `Todos os ${tipo === 'GRUPO' ? 'grupos' : 'alunos'} enviaram o registro ${periodo}.`
    : tipo === 'GRUPO'
      ? `${n} ${n === 1 ? 'grupo não enviou' : 'grupos não enviaram'} o registro ${periodo}.`
      : `${n} ${n === 1 ? 'aluno não enviou' : 'alunos não enviaram'} o registro ${periodo}.`;
  return {
    dias, de, ate: hojeIso, totalUnidades: unidades.length, semEnvio: n, tipo, texto,
    nomes: faltam.map(u => u.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}
