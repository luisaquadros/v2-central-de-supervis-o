/**
 * Chamada com a notação do caderno da professora e importação de registros em lote.
 * Funções puras: recebem os dados e devolvem o que gravar (testáveis sem planilha).
 *
 * Notação do caderno → campos:
 *   • presente   F falta   J falta justificada   ✓ participou   / atraso   \ saiu mais cedo
 *   — conversa   c celular   marca-texto = apresentou   + ótima   o média   ↓ mínima
 */
import type { DadosBase, Entrega, EncontroTurma, Feedback, Frequencia, LeituraResponsavel, Ocorrencia, Avaliacao } from '../types';

export type Apresentacao = '' | 'APRESENTOU' | 'OTIMA' | 'MEDIA' | 'MINIMA';

export interface MarcacaoChamada {
  faltou: boolean;
  /** Falta justificada (J no caderno). */
  justificada?: boolean;
  atraso: boolean;
  celular: boolean;
  conversa?: boolean;
  saiuCedo?: boolean;
  participou?: boolean;
  apresentacao?: Apresentacao;
  justificativa?: string;
  observacao?: string;
}

export const MARCACAO_VAZIA: MarcacaoChamada = { faltou: false, atraso: false, celular: false };

export interface AlteracaoPlanilha {
  tabela: string;
  tipo: 'INSERT' | 'UPDATE' | 'DELETE';
  registro: Record<string, any>;
  campos?: string[];
}

/** Marcas que viram ocorrência na ficha (id fixo por estudante/data: salvar de novo não duplica). */
const MARCAS_OCORRENCIA = [
  { campo: 'atraso', tipo: 'ATRASO', sufixo: 'atraso', texto: 'Chegou após o início da supervisão' },
  { campo: 'celular', tipo: 'USO_INADEQUADO_DISPOSITIVO', sufixo: 'celular', texto: 'Uso de celular durante a supervisão' },
  { campo: 'conversa', tipo: 'CONVERSA_PARALELA', sufixo: 'conversa', texto: 'Conversa paralela durante a supervisão' },
  { campo: 'saiuCedo', tipo: 'SAIDA_ANTECIPADA', sufixo: 'saida', texto: 'Saiu antes do fim da supervisão' },
] as const;

export interface ResultadoChamada {
  frequencias: Frequencia[];
  ocorrenciasNovas: Ocorrencia[];
  ocorrenciasRemover: Ocorrencia[];
  encontro: EncontroTurma;
  /** O encontro já existia na planilha: atualiza só os campos da chamada. */
  encontroJaExistia: boolean;
}

/**
 * Monta a chamada de uma aula. `matriculaIds` define quem entra: na aula, a turma toda;
 * na importação, só quem aparece no caderno naquele dia (quem ainda não estava na turma fica de fora).
 */
export function montarChamada(d: DadosBase, args: {
  turmaId: string;
  dataAula: string;
  marcacoes: Record<string, MarcacaoChamada>;
  matriculaIds: string[];
  agora: string;
  novoId: (prefixo: string) => string;
  periodoPadrao?: string;
  fonte?: string;
}): ResultadoChamada {
  const { turmaId, dataAula, marcacoes, matriculaIds, agora, novoId } = args;
  const horaAula = d.horarios.find(h => h.turma_id === turmaId && h.ativo)?.hora_inicio || '08:00';
  const origemPadrao = d.turmasOrigem.find(o => o.turma_id === turmaId && o.ativo)?.origem_id || '';
  const frequencias: Frequencia[] = [];
  const ocorrenciasNovas: Ocorrencia[] = [];
  const ocorrenciasRemover: Ocorrencia[] = [];
  let faltas = 0;

  for (const id of matriculaIds) {
    const m = marcacoes[id] || MARCACAO_VAZIA;
    const matricula = d.matriculas.find(x => x.matricula_id === id);
    const existente = d.frequencias.find(f => f.matricula_id === id && f.data_aula === dataAula);
    let status: Frequencia['status'] = 'PRESENTE';
    if (m.faltou) {
      faltas++;
      status = m.justificada || existente?.status === 'FALTA_JUSTIFICADA' ? 'FALTA_JUSTIFICADA'
        : m.justificativa ? 'JUSTIFICATIVA_PENDENTE' : 'FALTA_SEM_JUSTIFICATIVA';
    }
    const presente = !m.faltou;
    frequencias.push({
      ...(existente || {}),
      frequencia_id: existente?.frequencia_id || novoId('freq'),
      matricula_id: id,
      data_aula: dataAula,
      status,
      justificativa: m.faltou ? (m.justificativa || existente?.justificativa || '') : '',
      origem_id: existente?.origem_id || (matricula as any)?.origem_id || origemPadrao,
      atraso: presente && m.atraso,
      celular: presente && m.celular,
      conversa: presente && Boolean(m.conversa),
      saiu_cedo: presente && Boolean(m.saiuCedo),
      participou: presente && Boolean(m.participou),
      apresentacao: presente ? (m.apresentacao || '') : '',
      observacao: m.observacao || '',
      criado_em: existente?.criado_em || agora,
      atualizado_em: agora,
    });
    for (const marca of MARCAS_OCORRENCIA) {
      const ocorrenciaId = `oc-${id}-${dataAula}-${marca.sufixo}`;
      const anterior = d.ocorrencias.find(o => o.ocorrencia_id === ocorrenciaId);
      if (presente && (m as any)[marca.campo]) {
        ocorrenciasNovas.push({
          ocorrencia_id: ocorrenciaId, matricula_id: id, data_hora: `${dataAula}T${horaAula}:00`, tipo: marca.tipo,
          observacao: m.observacao || marca.texto,
        });
      } else if (anterior) {
        ocorrenciasRemover.push(anterior);
      }
    }
  }

  const existente = d.encontros.find(e => e.turma_id === turmaId && e.data === dataAula);
  const encontro: EncontroTurma = {
    ...existente,
    encontro_id: existente?.encontro_id || `aula-${dataAula}-${turmaId}`,
    turma_id: turmaId,
    periodo_id: d.turmas.find(t => t.turma_id === turmaId)?.periodo_id || args.periodoPadrao || '',
    data: dataAula,
    status: 'REALIZADO',
    chamada_salva: true,
    total_presentes: matriculaIds.length - faltas,
    total_faltas: faltas,
    atualizado_em: agora,
    fonte: existente?.fonte || args.fonte || 'APP',
  };
  return { frequencias, ocorrenciasNovas, ocorrenciasRemover, encontro, encontroJaExistia: Boolean(existente) };
}

/** Aplica uma chamada montada aos dados da tela. */
export function aplicarChamada(d: DadosBase, r: ResultadoChamada): DadosBase {
  const novas = new Set(r.ocorrenciasNovas.map(o => o.ocorrencia_id));
  const remover = new Set(r.ocorrenciasRemover.map(o => o.ocorrencia_id));
  const chave = (f: Frequencia) => `${f.matricula_id}|${f.data_aula}`;
  const freqNovas = new Set(r.frequencias.map(chave));
  return {
    ...d,
    frequencias: [...d.frequencias.filter(f => !freqNovas.has(chave(f))), ...r.frequencias],
    ocorrencias: [...r.ocorrenciasNovas, ...d.ocorrencias.filter(o => !novas.has(o.ocorrencia_id) && !remover.has(o.ocorrencia_id))],
    encontros: [...d.encontros.filter(e => !(e.turma_id === r.encontro.turma_id && e.data === r.encontro.data)), r.encontro],
  };
}

export function alteracoesDaChamada(r: ResultadoChamada): AlteracaoPlanilha[] {
  return [
    ...r.frequencias.map(f => ({ tabela: 'frequencias', tipo: 'INSERT' as const, registro: f })),
    ...r.ocorrenciasNovas.map(o => ({ tabela: 'ocorrencias', tipo: 'INSERT' as const, registro: o })),
    ...r.ocorrenciasRemover.map(o => ({ tabela: 'ocorrencias', tipo: 'DELETE' as const, registro: o })),
    r.encontroJaExistia
      ? { tabela: 'encontros_turma', tipo: 'UPDATE' as const, registro: r.encontro, campos: ['status', 'chamada_salva', 'total_presentes', 'total_faltas', 'atualizado_em'] }
      : { tabela: 'encontros_turma', tipo: 'INSERT' as const, registro: r.encontro },
  ];
}

// ---------------------------------------------------------------------------
// Importação em lote (ex.: caderno de chamada e notas transcrito)
// ---------------------------------------------------------------------------

export interface PacoteImportacao {
  versao: 1;
  fonte: string;
  chamadas?: { turma_id: string; data: string; marcacoes: (MarcacaoChamada & { matricula_id: string; nome?: string; conferir?: boolean })[] }[];
  sem_aula?: { turma_id: string; data: string; motivo: string }[];
  /** Nota na escala em que foi dada (ex.: prova de 0 a 10); o app converte para o peso do critério. */
  notas?: { matricula_id: string; nome?: string; turma_id: string; codigo_criterio: string; valor: number; escala: number }[];
  entregas?: { matricula_id: string; nome?: string; turma_id: string; codigo: string; data_envio?: string; observacao?: string }[];
  anotacoes_turma?: { turma_id: string; data: string; texto: string; categoria?: string }[];
  /** Agenda de apresentações anotada no caderno: só para conferir com a planilha. */
  apresentacoes?: { turma_id: string; matricula_id: string; nome?: string; data: string }[];
  /** Linhas do caderno que não foram ligadas a nenhum estudante. */
  sem_vinculo?: { turma_id: string; nome: string; motivo: string }[];
}

export interface ResumoImportacao {
  aulas: number;
  presencas: number;
  faltas: number;
  ocorrencias: number;
  semAula: number;
  notasNovas: number;
  notasAlteradas: number;
  notasIguais: number;
  /** Notas em que o caderno e a planilha discordam: só mudam se a professora marcar. */
  notasDiferentes: { chave: string; matricula_id: string; nome: string; turma_id: string; criterio: string; planilha: string; caderno: string }[];
  entregasNovas: number;
  entregasAtualizadas: number;
  anotacoes: number;
  apresentacoesConfirmadas: number;
  paraConferir: { turma_id: string; data: string; nome: string; observacao: string }[];
  agendaDiferente: { turma_id: string; nome: string; dataCaderno: string; dataPlanilha: string }[];
  semVinculo: { turma_id: string; nome: string; motivo: string }[];
  avisos: string[];
}

export interface PlanoImportacao {
  alteracoes: AlteracaoPlanilha[];
  aplicar: (d: DadosBase) => DadosBase;
  resumo: ResumoImportacao;
}

const TEXTO_ENTREGUE = 'Entregue';

function hash(texto: string): string {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const formatarValor = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');

export function planejarImportacao(d: DadosBase, pacote: PacoteImportacao, ctx: {
  agora: string;
  novoId: (prefixo: string) => string;
  responsaveisDaLeitura: (l: LeituraResponsavel) => { nome: string; matriculaId?: string }[];
  leiturasDaAula: (turmaId: string, data: string) => LeituraResponsavel[];
  /** Chaves (matrícula|critério) das notas diferentes que a professora escolheu substituir. */
  substituirNotas?: Set<string>;
}): PlanoImportacao {
  const resumo: ResumoImportacao = {
    aulas: 0, presencas: 0, faltas: 0, ocorrencias: 0, semAula: 0, notasNovas: 0, notasAlteradas: 0, notasIguais: 0,
    entregasNovas: 0, entregasAtualizadas: 0, anotacoes: 0, apresentacoesConfirmadas: 0, notasDiferentes: [],
    paraConferir: [], agendaDiferente: [], semVinculo: pacote.sem_vinculo || [], avisos: [],
  };
  const alteracoes: AlteracaoPlanilha[] = [];
  const passos: ((x: DadosBase) => DadosBase)[] = [];
  const matriculasValidas = new Set(d.matriculas.map(m => m.matricula_id));

  // 1. Chamadas
  for (const c of pacote.chamadas || []) {
    const validas = c.marcacoes.filter(m => matriculasValidas.has(m.matricula_id));
    if (validas.length < c.marcacoes.length) resumo.avisos.push(`${c.marcacoes.length - validas.length} marcação(ões) de ${c.data} sem matrícula na planilha foram ignoradas.`);
    if (validas.length === 0) continue;
    const anterior = d.encontros.find(e => e.turma_id === c.turma_id && e.data === c.data);
    if (anterior && anterior.status !== 'REALIZADO' && anterior.status !== 'PREVISTO') {
      resumo.avisos.push(`A aula de ${c.data} estava marcada como "${anterior.status}" e passa a constar como realizada (há chamada no caderno).`);
    }
    const r = montarChamada(d, {
      turmaId: c.turma_id, dataAula: c.data, agora: ctx.agora, novoId: ctx.novoId, fonte: 'CADERNO',
      matriculaIds: validas.map(m => m.matricula_id),
      marcacoes: Object.fromEntries(validas.map(m => [m.matricula_id, m])),
    });
    resumo.aulas++;
    resumo.presencas += r.frequencias.filter(f => f.status === 'PRESENTE').length;
    resumo.faltas += r.frequencias.filter(f => f.status !== 'PRESENTE').length;
    resumo.ocorrencias += r.ocorrenciasNovas.length;
    validas.filter(m => m.conferir).forEach(m => resumo.paraConferir.push({ turma_id: c.turma_id, data: c.data, nome: m.nome || '', observacao: m.observacao || '' }));
    alteracoes.push(...alteracoesDaChamada(r));
    passos.push(x => aplicarChamada(x, r));

    // Apresentação marcada no caderno confirma o estudo dirigido daquela aula.
    const apresentaram = validas.filter(m => m.apresentacao && !m.faltou);
    if (apresentaram.length > 0) {
      for (const l of ctx.leiturasDaAula(c.turma_id, c.data)) {
        if (l.status_realizacao) continue;
        const resp = ctx.responsaveisDaLeitura(l);
        const efetivos = resp.filter(p => apresentaram.some(a => a.matricula_id === p.matriculaId));
        if (efetivos.length === 0) continue;
        const atualizada: LeituraResponsavel = { ...l, status_realizacao: 'REALIZADO', responsaveis_efetivos: efetivos.map(p => p.nome) };
        alteracoes.push({ tabela: 'leituras_responsaveis', tipo: 'UPDATE', registro: atualizada, campos: ['status_realizacao', 'responsaveis_efetivos'] });
        passos.push(x => ({ ...x, leiturasResponsaveis: x.leiturasResponsaveis.map(y => y.leitura_id === l.leitura_id ? atualizada : y) }));
        resumo.apresentacoesConfirmadas++;
      }
    }
  }

  // 2. Dias sem aula (coluna inteira com X no caderno)
  for (const s of pacote.sem_aula || []) {
    const anterior = d.encontros.find(e => e.turma_id === s.turma_id && e.data === s.data);
    if (anterior && anterior.status !== 'PREVISTO') continue;
    const encontro: EncontroTurma = {
      ...anterior,
      encontro_id: anterior?.encontro_id || `aula-${s.data}-${s.turma_id}`,
      turma_id: s.turma_id,
      periodo_id: d.turmas.find(t => t.turma_id === s.turma_id)?.periodo_id || '',
      data: s.data, status: 'NAO_REALIZADO', motivo_nao_realizado: s.motivo, atualizado_em: ctx.agora, fonte: 'CADERNO',
    };
    alteracoes.push({ tabela: 'encontros_turma', tipo: 'INSERT', registro: encontro });
    passos.push(x => ({ ...x, encontros: [...x.encontros.filter(e => !(e.turma_id === s.turma_id && e.data === s.data)), encontro] }));
    resumo.semAula++;
  }

  // 3. Notas (só grava o que mudou)
  for (const n of pacote.notas || []) {
    if (!matriculasValidas.has(n.matricula_id)) continue;
    const criterio = d.criterios.find(c => c.turma_id === n.turma_id && String(c.codigo_criterio || '').toUpperCase() === n.codigo_criterio.toUpperCase());
    if (!criterio) { resumo.avisos.push(`Critério ${n.codigo_criterio} não existe na turma; nota ignorada.`); continue; }
    const maximo = Number(String(criterio.nota_maxima ?? n.escala).replace(',', '.')) || n.escala;
    const nota = Math.round((n.valor * maximo / n.escala) * 100) / 100;
    const existente = d.avaliacoes.find(a => a.matricula_id === n.matricula_id && a.criterio_id === criterio.criterio_id);
    if (existente && Math.abs(Number(existente.nota) - nota) < 0.006) { resumo.notasIguais++; continue; }
    const chave = `${n.matricula_id}|${criterio.criterio_id}`;
    if (existente) {
      resumo.notasDiferentes.push({
        chave, matricula_id: n.matricula_id, nome: n.nome || '', turma_id: n.turma_id, criterio: String(criterio.nome || n.codigo_criterio),
        planilha: existente.valor_original || formatarValor(Number(existente.nota) * n.escala / maximo), caderno: formatarValor(n.valor),
      });
      if (!ctx.substituirNotas?.has(chave)) continue;
    }
    const registro: Avaliacao = {
      ...(existente || {}),
      avaliacao_id: existente?.avaliacao_id || `av-${n.matricula_id}-${criterio.criterio_id}`,
      matricula_id: n.matricula_id, criterio_id: criterio.criterio_id, nota,
      observacao: existente?.observacao || '', valor_original: formatarValor(n.valor), origem: existente?.origem || 'CADERNO',
    };
    alteracoes.push(existente
      ? { tabela: 'avaliacoes', tipo: 'UPDATE', registro, campos: ['nota', 'valor_original'] }
      : { tabela: 'avaliacoes', tipo: 'INSERT', registro });
    passos.push(x => ({ ...x, avaliacoes: [...x.avaliacoes.filter(a => a.avaliacao_id !== registro.avaliacao_id), registro] }));
    if (existente) resumo.notasAlteradas++; else resumo.notasNovas++;
  }

  // 4. Entregas confirmadas no caderno ("ok")
  for (const e of pacote.entregas || []) {
    if (!matriculasValidas.has(e.matricula_id)) continue;
    const existente = d.entregas.find(x => x.matricula_id === e.matricula_id
      && String(x.codigo_entrega || x.tipo_entrega || x.tipo_documento || '').toUpperCase() === e.codigo.toUpperCase());
    if (existente) {
      if (existente.situacao === 'ENTREGUE') continue;
      const atualizada: Entrega = { ...existente, status: TEXTO_ENTREGUE, status_entrega: TEXTO_ENTREGUE, situacao: 'ENTREGUE', data_envio: e.data_envio || existente.data_envio || '' };
      alteracoes.push({ tabela: 'entregas', tipo: 'UPDATE', registro: atualizada, campos: e.data_envio ? ['status', 'data_envio'] : ['status'] });
      passos.push(x => ({ ...x, entregas: x.entregas.map(y => y.entrega_id === existente.entrega_id ? atualizada : y) }));
      resumo.entregasAtualizadas++;
    } else {
      const nova: Entrega = {
        entrega_id: `ent-${e.codigo.toLowerCase()}-${e.matricula_id}`, periodo_id: d.turmas.find(t => t.turma_id === e.turma_id)?.periodo_id || '',
        turma_id: e.turma_id, matricula_id: e.matricula_id, codigo_entrega: e.codigo, tipo_entrega: e.codigo, tipo_documento: e.codigo,
        escopo: 'INDIVIDUAL', status: TEXTO_ENTREGUE, status_entrega: TEXTO_ENTREGUE, situacao: 'ENTREGUE',
        data_envio: e.data_envio || '', data_entrega: e.data_envio || '', origem: 'CADERNO',
      };
      alteracoes.push({ tabela: 'entregas', tipo: 'INSERT', registro: nova });
      passos.push(x => ({ ...x, entregas: [...x.entregas, nova] }));
      resumo.entregasNovas++;
    }
  }

  // 5. Anotações sobre a turma
  for (const a of pacote.anotacoes_turma || []) {
    const id = `fb-caderno-${hash(`${a.turma_id}|${a.texto}`)}`;
    if (d.feedbacks.some(f => f.feedback_id === id)) continue;
    const novo: Feedback = {
      feedback_id: id, periodo_id: d.turmas.find(t => t.turma_id === a.turma_id)?.periodo_id || '', turma_id: a.turma_id, escopo: 'TURMA',
      matricula_id: '', data: a.data, data_hora: a.data, categoria: a.categoria || 'Anotação do caderno', texto: a.texto,
      incluir_na_devolutiva: 'NAO_AUTOMATICO', criado_em: ctx.agora, atualizado_em: ctx.agora,
    };
    alteracoes.push({ tabela: 'feedbacks', tipo: 'INSERT', registro: novo });
    passos.push(x => ({ ...x, feedbacks: [novo, ...x.feedbacks] }));
    resumo.anotacoes++;
  }

  // 6. Agenda de apresentações: só compara (a planilha continua sendo a fonte da agenda)
  for (const ap of pacote.apresentacoes || []) {
    const daTurma = d.leiturasResponsaveis.filter(l => l.turma_id === ap.turma_id);
    const minhas = daTurma.filter(l => ctx.responsaveisDaLeitura(l).some(p => p.matriculaId === ap.matricula_id));
    if (minhas.some(l => l.data === ap.data)) continue;
    resumo.agendaDiferente.push({
      turma_id: ap.turma_id, nome: ap.nome || '', dataCaderno: ap.data,
      dataPlanilha: minhas.map(l => l.data).filter(Boolean).sort().join(', ') || 'sem apresentação na planilha',
    });
  }

  return { alteracoes, resumo, aplicar: x => passos.reduce((acc, p) => p(acc), x) };
}
