/**
 * Gerador DETERMINÍSTICO de rascunho de devolutiva (sem IA externa, sem envio).
 *
 * Cada frase nasce de um dado estruturado: nível escolhido na rubrica (com o descritor do nível), evidência registrada,
 * nota oficial lançada, situação dos registros semanais ou pendência de entrega. Sem dado, o texto diz
 * "informação insuficiente" e a pendência aparece na lista de complementação.
 *
 * Não faz: diagnóstico, juízo de personalidade, projeção de nota, média parcial, elogio sem evidência.
 * "Não constam registros" descreve a base de dados; não afirma conduta. O resultado é um RASCUNHO editável.
 */
import { formatarPontos, type ResultadoAvaliacao } from './avaliacaoEngine';
import { ROTULO_NIVEL, descritorDoNivel, type RascunhoAvaliacao, type RubricaVersao } from './rubricasAvaliacao';
import type { EvidenciaAvaliacao } from './estruturaAvaliacao';

export interface IndicadoresRss { realizados: number; esperadosAteOPrazo: number; totalPrevisto: number; semanaAtual?: number | null; unidade?: 'INDIVIDUAL' | 'GRUPO' }
export interface PendenciaDocumento { nome: string; situacao: 'PENDENTE' | 'A_CONFERIR' | 'ENTREGUE_FORA_DO_PRAZO' }

export interface EntradaDevolutiva {
  resultado: ResultadoAvaliacao;
  rubrica?: RubricaVersao | null;
  rascunho?: RascunhoAvaliacao | null;
  evidencias: EvidenciaAvaliacao[];
  /** ids de evidências preliminares (monitora) que a professora decidiu usar */
  preliminaresAprovadas?: ReadonlySet<string>;
  rss?: IndicadoresRss | null;
  documentos?: PendenciaDocumento[];
  /** o app ainda não registra participação em sala: informe true quando houver registro estruturado */
  temRegistroParticipacao?: boolean | null;
  geradoEm: string;
}

export interface ItemDevolutiva { texto: string; fontes: string[] }
export interface SecaoDevolutiva { id: 'notas' | 'fortes' | 'desenvolvimento' | 'aprimoramento' | 'recomendacoes' | 'proximos'; titulo: string; itens: ItemDevolutiva[] }
export interface DevolutivaRascunho {
  status: 'RASCUNHO';
  geradoEm: string;
  secoes: SecaoDevolutiva[];
  /** o que falta para o texto ficar sustentado por evidências */
  complementar: string[];
  texto: string;
}

const NIVEIS_FORTES = new Set(['EXCELENTE', 'ADEQUADO']);
const NIVEIS_APRIMORAR = new Set(['INSUFICIENTE', 'NAO_ATENDIDO']);
const nivelDe = (r: RascunhoAvaliacao | null | undefined, id: string) => r?.selecoes.find(s => s.subcriterio_id === id);
const dataBr = (iso: string) => /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : iso;

function evidenciasUsaveis(e: EntradaDevolutiva): EvidenciaAvaliacao[] {
  return e.evidencias.filter(x => x.observacao.trim() !== '' && (!x.preliminar || e.preliminaresAprovadas?.has(x.evidencia_id)));
}
const fonteEvidencia = (x: EvidenciaAvaliacao) => `evidência ${x.evidencia_id} (${dataBr(x.data)}, ${x.origem.toLowerCase().replaceAll('_', ' ')})`;

export function gerarRascunhoDevolutiva(e: EntradaDevolutiva): DevolutivaRascunho {
  const fortes: ItemDevolutiva[] = [], desenvolvimento: ItemDevolutiva[] = [], aprimorar: ItemDevolutiva[] = [];
  const recomendacoes: ItemDevolutiva[] = [], proximos: ItemDevolutiva[] = [], notas: ItemDevolutiva[] = [];
  const complementar: string[] = [];

  // 1) Notas oficiais por item (fatos já lançados; sem média, sem conversão, sem projeção)
  for (const c of e.resultado.criterios) {
    if (c.invalida) { complementar.push(`Conferir a nota de "${c.nome}" na base (valor inválido).`); notas.push({ texto: `${c.nome}: nota a conferir.`, fontes: ['avaliacoes'] }); continue; }
    if (c.oficial !== null) notas.push({ texto: `${c.nome}: ${formatarPontos(c.oficial)} de ${formatarPontos(c.maxPontos)}.`, fontes: ['avaliacoes'] });
    else notas.push({ texto: `${c.nome}: ainda não avaliado nesta etapa.`, fontes: ['avaliacoes'] });
  }
  if (e.resultado.criterios.length) notas.push({ texto: `Acumulado oficial até o prazo: ${formatarPontos(e.resultado.totalOficial)} de ${formatarPontos(e.resultado.totalMaximo)}. Esse valor refere-se apenas ao percurso registrado até o momento e não corresponde à nota final.`, fontes: ['avaliacoes'] });

  // 2) Rubrica: nível → descritor específico do subcritério
  if (e.rubrica && e.rascunho) {
    for (const def of e.rubrica.subcriterios) {
      const sel = nivelDe(e.rascunho, def.subcriterio_id);
      const fonte = `rubrica ${e.rubrica.rubrica_id} v${e.rubrica.versao} · ${def.nome}`;
      if (!sel || sel.nivel === 'NAO_AVALIADO') {
        complementar.push(`Avaliar "${def.nome}" na rubrica (ainda sem nível).`);
        desenvolvimento.push({ texto: `${def.nome}: informação insuficiente para avaliar neste momento.`, fontes: [fonte] });
        continue;
      }
      const descr = descritorDoNivel(e.rubrica, def.subcriterio_id, sel.nivel);
      const base = `${def.nome} (${ROTULO_NIVEL[sel.nivel].toLowerCase()}): ${descr}`;
      const comentario = sel.comentario?.trim() ? ` ${sel.comentario.trim()}` : '';
      const item = { texto: base + comentario, fontes: [fonte] };
      if (NIVEIS_FORTES.has(sel.nivel)) fortes.push(item);
      else if (NIVEIS_APRIMORAR.has(sel.nivel)) aprimorar.push(item);
      else desenvolvimento.push(item);
      if (sel.nivel !== 'EXCELENTE') {
        const foco = def.foco.slice(0, 3).join('; ');
        recomendacoes.push({ texto: `${def.nome}: reveja ${foco}${def.foco.length > 3 ? ' e os demais aspectos da rubrica' : ''}.`, fontes: [fonte] });
      }
    }
  } else {
    complementar.push('Não há rubrica avaliada: preencha os níveis para sustentar os pontos fortes e de aprimoramento.');
  }

  // 3) Evidências registradas (observação objetiva, com a fonte)
  for (const x of evidenciasUsaveis(e)) {
    const item = { texto: x.observacao.trim(), fontes: [fonteEvidencia(x)] };
    if (x.polaridade === 'POSITIVO') fortes.push(item);
    else if (x.polaridade === 'DESENVOLVER') aprimorar.push(item);
  }
  if (!e.evidencias.length) complementar.push('Nenhuma evidência registrada ao longo do semestre: acrescente observações objetivas antes de finalizar.');

  // 4) Registros semanais: atraso é fato mensurável; o impacto na avaliação segue os critérios da disciplina
  if (e.rss) {
    const r = e.rss, quem = r.unidade === 'GRUPO' ? 'pelo grupo' : 'pelo(a) estudante';
    const sem = r.semanaAtual ? ` Estamos na semana ${r.semanaAtual}.` : '';
    if (r.realizados < r.esperadosAteOPrazo) {
      const faltam = r.esperadosAteOPrazo - r.realizados;
      aprimorar.push({ texto: `Registros semanais: constam ${r.realizados} de ${r.esperadosAteOPrazo} esperados até o prazo (${r.totalPrevisto} previstos no semestre), enviados ${quem}.${sem} Há atraso, o que pode refletir na avaliação conforme os critérios da disciplina.`, fontes: ['registros_semanais'] });
      proximos.push({ texto: `Enviar os ${faltam} registro(s) semanal(is) pendente(s) até [definir data com a professora] e manter o envio semanal nas próximas semanas.`, fontes: ['registros_semanais'] });
      complementar.push('Definir a data do compromisso de envio dos registros pendentes.');
    } else {
      fortes.push({ texto: `Registros semanais: constam ${r.realizados} de ${r.esperadosAteOPrazo} esperados até o prazo (${r.totalPrevisto} previstos no semestre).`, fontes: ['registros_semanais'] });
    }
  } else complementar.push('Situação dos registros semanais não informada.');

  // 5) Documentos / entregas pendentes (A conferir ≠ pendente)
  for (const d of e.documentos ?? []) {
    if (d.situacao === 'PENDENTE') { proximos.push({ texto: `Entregar: ${d.nome}.`, fontes: ['documentos'] }); aprimorar.push({ texto: `${d.nome}: entrega pendente.`, fontes: ['documentos'] }); }
    else if (d.situacao === 'A_CONFERIR') complementar.push(`Conferir a entrega de "${d.nome}" (ainda sem confirmação).`);
    else aprimorar.push({ texto: `${d.nome}: entregue após o prazo.`, fontes: ['documentos'] });
  }

  // 6) Participação nas supervisões: ausência de registro não prova conduta
  if (e.temRegistroParticipacao === true) {
    // há registro estruturado: os pontos aparecem pelas evidências/rubrica
  } else {
    aprimorar.push({ texto: 'Não constam registros de participação nas supervisões neste período. Recomenda-se participar mais ativamente das discussões, trazendo casos, dúvidas e a fundamentação das decisões.', fontes: ['evidencias_avaliacao'] });
    complementar.push('Sem registro de participação nas supervisões: conferir se há evidências antes de enviar.');
  }

  // 7) Pendências do motor
  for (const o of e.resultado.ocorrenciasPendentes) complementar.push(`Ocorrência ${o.id} aguardando decisão da professora (nenhum desconto aplicado).`);
  for (const s of e.resultado.sinalizacoes) complementar.push(s.mensagem);
  for (const d of e.resultado.divergencias) complementar.push(`Divergência em "${d.nome}": oficial ${formatarPontos(d.oficial)} × prévia ${formatarPontos(d.previa)}; a nota oficial foi mantida.`);

  const secoes: SecaoDevolutiva[] = [
    { id: 'notas', titulo: 'Notas lançadas até o momento', itens: notas },
    { id: 'fortes', titulo: 'Pontos fortes observados', itens: fortes },
    { id: 'desenvolvimento', titulo: 'Competências em desenvolvimento', itens: desenvolvimento },
    { id: 'aprimoramento', titulo: 'Aspectos que exigem aprimoramento', itens: aprimorar },
    { id: 'recomendacoes', titulo: 'Recomendações específicas', itens: recomendacoes },
    { id: 'proximos', titulo: 'Próximos passos', itens: proximos },
  ];
  const texto = secoes
    .map(s => `${s.titulo}\n${s.itens.length ? s.itens.map(i => `- ${i.texto}`).join('\n') : '- Sem registros suficientes para esta seção.'}`)
    .join('\n\n');
  return { status: 'RASCUNHO', geradoEm: e.geradoEm, secoes, complementar: Array.from(new Set(complementar)), texto };
}

/** Termos que um rascunho nunca deve conter (julgamento de personalidade, diagnóstico, projeção). */
export const TERMOS_PROIBIDOS = [/pregui[cç]/i, /desinteress/i, /pessoa\s+(dif[ií]cil|imatura)/i, /personalidade/i, /diagn[oó]stic/i, /transtorno/i, /vai\s+(reprovar|passar)/i, /m[eé]dia\s+parcial/i, /proje[cç][aã]o/i, /nota\s+final\s+(ser[aá]|prevista)/i];
export const contemTermoProibido = (texto: string) => TERMOS_PROIBIDOS.some(t => t.test(texto));
