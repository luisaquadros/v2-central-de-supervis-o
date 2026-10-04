import { Aluno, Turma, GrupoPratica } from '../types';

export interface SugestaoCaixaEntrada {
  tipo: string;
  tipoLabel: string;
  alunoId?: string;
  alunoNome?: string;
  turmaId?: string;
  turmaNome?: string;
  grupoId?: string;
  grupoNome?: string;
  dataRelacionada: string;
  canal?: string;
  observacao: string;
  confianca: number;
  ambiguo: boolean;
  motivoAmbiguidade?: string;
}

export interface ResultadoClassificacaoTexto {
  textoOriginal: string;
  sugestoes: SugestaoCaixaEntrada[];
  precisaConfirmacao: boolean;
  naoClassificado: boolean;
}

/**
 * Normaliza strings para busca sem acentos e minúsculas
 */
function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrai data aproximada mencionada no texto
 */
function extrairDataMencionada(textoNorm: string): string {
  const hoje = new Date();
  const formatYmd = (d: Date) => d.toISOString().split('T')[0];

  if (textoNorm.includes('hoje')) {
    return formatYmd(hoje);
  }
  if (textoNorm.includes('ontem')) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    return formatYmd(d);
  }
  if (textoNorm.includes('anteontem')) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 2);
    return formatYmd(d);
  }

  // Dias da semana (ex: "quinta", "terça", "segunda")
  const diasSemanaMap: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
  };

  for (const [diaStr, diaNum] of Object.entries(diasSemanaMap)) {
    if (textoNorm.includes(diaStr)) {
      const d = new Date(hoje);
      const diaHoje = d.getDay();
      let diff = diaHoje - diaNum;
      if (diff <= 0) diff += 7; // busca o dia da semana passado mais recente
      d.setDate(d.getDate() - diff);
      return formatYmd(d);
    }
  }

  // Regex para formato DD/MM ou DD/MM/AAAA
  const dateMatch = textoNorm.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const dia = parseInt(dateMatch[1], 10);
    const mes = parseInt(dateMatch[2], 10) - 1;
    const ano = dateMatch[3] ? parseInt(dateMatch[3], 10) : hoje.getFullYear();
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) {
      return formatYmd(d);
    }
  }

  return formatYmd(hoje);
}

/**
 * Classifica texto livre da Caixa de Entrada em registros estruturados propostos
 */
export function classificarTextoLivre(
  texto: string,
  alunos: Aluno[],
  turmas: Turma[],
  grupos: GrupoPratica[]
): ResultadoClassificacaoTexto {
  const norm = normalizeText(texto);
  const dataRelacionada = extrairDataMencionada(norm);

  // 1. Identificar Canal
  let canal = 'Registro manual';
  if (norm.includes('whatsapp') || norm.includes('zap')) canal = 'WhatsApp';
  else if (norm.includes('email') || norm.includes('e-mail')) canal = 'E-mail';
  else if (norm.includes('presencial') || norm.includes('em aula') || norm.includes('supervisao')) canal = 'Presencial / Aula';
  else if (norm.includes('telefone') || norm.includes('ligou')) canal = 'Telefone';

  // 2. Identificar Turma
  let turmaEncontrada: Turma | undefined;
  for (const t of turmas) {
    const tNome = normalizeText(t.nome);
    if (norm.includes(tNome) || (tNome.includes('adulto') && norm.includes('adulto')) || (tNome.includes('ampliada') && norm.includes('ampliada'))) {
      turmaEncontrada = t;
      break;
    }
  }

  // 3. Identificar Aluno ou Ambiguidade
  let alunoEncontrado: Aluno | undefined;
  let alunosCandidatos: Aluno[] = [];

  for (const a of alunos) {
    const aNome = normalizeText(a.nome);
    const primeiroNome = aNome.split(' ')[0];
    if (primeiroNome.length > 2 && norm.includes(primeiroNome)) {
      alunosCandidatos.push(a);
    }
  }

  let ambiguoAluno = false;
  let motivoAmbiguidade: string | undefined;

  if (alunosCandidatos.length === 1) {
    alunoEncontrado = alunosCandidatos[0];
  } else if (alunosCandidatos.length > 1) {
    ambiguoAluno = true;
    motivoAmbiguidade = `Mais de um aluno compatível encontrado: ${alunosCandidatos.map(a => a.nome).join(', ')}`;
  }

  // 4. Identificar Grupo (Clínica Ampliada)
  let grupoEncontrado: GrupoPratica | undefined;
  for (const g of grupos) {
    const gNome = normalizeText(g.nome_grupo || '');
    if (gNome && norm.includes(gNome)) {
      grupoEncontrado = g;
      break;
    }
  }

  // 5. Determinar sugestões de tipos (podendo gerar mais de um registro)
  const sugestoes: SugestaoCaixaEntrada[] = [];

  const temJustificativa = norm.includes('justific') || norm.includes('doente') || norm.includes('atestado') || norm.includes('medico') || norm.includes('declaracao');
  const temFalta = norm.includes('falta') || norm.includes('faltou') || norm.includes('nao vira') || norm.includes('ausente');
  const temAtraso = norm.includes('atras') || norm.includes('tarde');
  const temDocumento = norm.includes('termo') || norm.includes('tcle') || norm.includes('documento') || norm.includes('entregou') || norm.includes('ficha');
  const temOrientacao = norm.includes('orient') || norm.includes('retomar') || norm.includes('sigilo') || norm.includes('manejo') || norm.includes('caso');
  const temCelular = norm.includes('celular') || norm.includes('dispositivo') || norm.includes('telefone em sala');
  const temContato = norm.includes('avisou') || norm.includes('chamou no') || norm.includes('mandou mensagem');

  if (temContato && (temJustificativa || temFalta)) {
    // Sugere contato + justificativa
    sugestoes.push({
      tipo: 'CONTATO_ALUNO',
      tipoLabel: 'Contato do Aluno',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.9,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  }

  if (temJustificativa) {
    sugestoes.push({
      tipo: 'JUSTIFICATIVA_FALTA',
      tipoLabel: 'Justificativa de Falta',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.95,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  } else if (temAtraso) {
    sugestoes.push({
      tipo: 'ATRASO',
      tipoLabel: 'Atraso em Aula/Supervisão',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.9,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  } else if (temFalta) {
    sugestoes.push({
      tipo: 'FALTA',
      tipoLabel: 'Registro de Ausência/Falta',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.85,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  } else if (temDocumento) {
    sugestoes.push({
      tipo: 'DOCUMENTO_ENTREGUE',
      tipoLabel: 'Entrega de Documento',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.9,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  } else if (temCelular) {
    sugestoes.push({
      tipo: 'USO_CELULAR',
      tipoLabel: 'Uso Inadequado de Dispositivo',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.9,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  } else if (temOrientacao || grupoEncontrado) {
    sugestoes.push({
      tipo: 'ORIENTACAO',
      tipoLabel: 'Orientação Acadêmica / Supervisão',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.85,
      ambiguo: ambiguoAluno,
      motivoAmbiguidade,
    });
  }

  // Se nada foi especificamente reconhecido, cria anotação geral
  if (sugestoes.length === 0) {
    sugestoes.push({
      tipo: 'ANOTACAO_GERAL',
      tipoLabel: 'Anotação / Caixa de Entrada',
      alunoId: alunoEncontrado?.aluno_id,
      alunoNome: alunoEncontrado?.nome,
      turmaId: turmaEncontrada?.turma_id,
      turmaNome: turmaEncontrada?.nome,
      grupoId: grupoEncontrado?.grupo_id,
      grupoNome: grupoEncontrado?.nome_grupo,
      dataRelacionada,
      canal,
      observacao: texto,
      confianca: 0.5,
      ambiguo: ambiguoAluno || !alunoEncontrado,
      motivoAmbiguidade: !alunoEncontrado ? 'Nenhum aluno identificado explicitamente.' : motivoAmbiguidade,
    });
  }

  const naoClassificado = sugestoes.every(s => s.tipo === 'ANOTACAO_GERAL' && !s.alunoId && !s.turmaId);

  return {
    textoOriginal: texto,
    sugestoes,
    precisaConfirmacao: true, // Sempre exige confirmação antes de gravar no banco oficial
    naoClassificado,
  };
}

/**
 * Responde consultas da professora com estrito embasamento nos dados reais carregados
 */
export function responderConsultaProfessora(
  pergunta: string,
  contexto: {
    turmas: Turma[];
    alunos: Aluno[];
    matriculas: any[];
    orientacoes: any[];
    documentos: any[];
    registrosSemanais: any[];
    leituras: any[];
    statusRssUnidades: any[];
    frequencias: any[];
  }
): string {
  const norm = normalizeText(pergunta);

  // 1. Quem ainda não recebeu feedback?
  if (norm.includes('feedback')) {
    return 'Na base oficial, os feedbacks estão associados às avaliações formais dos instrumentos. Consulte a aba "Avaliação" para o status de devolutivas de cada aluno.';
  }

  // 2. Orientações abertas há mais tempo
  if (norm.includes('orientac') && (norm.includes('aberta') || norm.includes('tempo') || norm.includes('antiga'))) {
    const abertas = contexto.orientacoes
      .filter(o => o.status === 'ABERTA')
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

    if (abertas.length === 0) {
      return 'Não há orientações em aberto no momento.';
    }

    const primeiras = abertas.slice(0, 3).map(o => {
      const mat = contexto.matriculas.find(m => m.matricula_id === o.matricula_id);
      const al = contexto.alunos.find(a => a.aluno_id === mat?.aluno_id);
      const dataStr = new Date(o.data_hora).toLocaleDateString('pt-BR');
      return `• ${al ? al.nome : 'Estudante'} (${dataStr}) [${o.categoria}]: "${o.texto}"`;
    });

    return `Existem ${abertas.length} orientações em aberto. As mais antigas são:\n${primeiras.join('\n')}`;
  }

  // 3. Quais alunos têm falta + RSS pendente?
  if ((norm.includes('falta') && norm.includes('rss')) || (norm.includes('ausenc') && norm.includes('rss'))) {
    const faltasMatriculaIds = new Set(
      contexto.frequencias.filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA').map(f => f.matricula_id)
    );

    const alunosComAmbos: string[] = [];
    contexto.matriculas.forEach(m => {
      if (faltasMatriculaIds.has(m.matricula_id)) {
        const al = contexto.alunos.find(a => a.aluno_id === m.aluno_id);
        const rss = contexto.statusRssUnidades.find(s => s.matricula_id === m.matricula_id);
        const entregasCount = contexto.registrosSemanais.filter(r => r.matricula_id === m.matricula_id && r.status === 'ENTREGUE').length;
        const esperado = rss?.total_esperado_ate_hoje || 0;
        if (esperado > entregasCount) {
          alunosComAmbos.push(`${al ? al.nome : 'Estudante'} (${entregasCount}/${esperado} RSS entregues)`);
        }
      }
    });

    if (alunosComAmbos.length === 0) {
      return 'Nenhum estudante apresenta falta sem justificativa acumulada com pendência de RSS.';
    }

    return `Estudantes com falta injustificada e RSS pendente:\n• ${alunosComAmbos.join('\n• ')}`;
  }

  // 4. Próxima leitura
  if (norm.includes('leitura') || norm.includes('texto') || norm.includes('tema')) {
    if (!contexto.leituras || contexto.leituras.length === 0) {
      return 'Nenhuma leitura cadastrada na tabela oficial leituras_responsaveis.';
    }
    const hojeStr = new Date().toISOString().split('T')[0];
    const proximas = contexto.leituras
      .filter(l => (l.data || '') >= hojeStr)
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    const alvo = proximas[0] || contexto.leituras[0];
    return `Próxima leitura programada:\nData: ${alvo.data || 'A definir'}\nTema: "${alvo.tema || alvo.titulo || 'Sem título'}"\nResponsável: ${alvo.responsavel_nome || alvo.responsavel_id || 'Turma geral'}`;
  }

  // 5. O que resolver hoje em determinada turma
  if (norm.includes('adulto') || norm.includes('hoje') || norm.includes('resolver')) {
    const abertasCount = contexto.orientacoes.filter(o => o.status === 'ABERTA').length;
    const docsPendentes = contexto.documentos.filter(d => d.status === 'PENDENTE').length;
    return `Central do dia:\n• ${abertasCount} orientações aguardando acompanhamento\n• ${docsPendentes} documentos pendentes de entrega\nConsulte a página "Hoje" para o painel operacional completo com ações rápidas.`;
  }

  return 'Consulta recebida. Não foram encontrados registros automáticos específicos para este critério na base oficial.';
}
