import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  FileCheck,
  MessageSquare,
  Award,
  Layers,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { normalizarNota, formatarNotaParaExibicao } from '../utils/gradeUtils';
import {
  ModalNovaOrientacao,
  ModalNovoFeedback,
  ModalRegistrarOcorrencia,
  ModalNovoPontoAcompanhamento,
} from '../components/Modals';

interface AlunoFichaViewProps {
  matriculaId: string;
  initialTab?: string;
  onVoltar: () => void;
}

export const AlunoFichaView: React.FC<AlunoFichaViewProps> = ({
  matriculaId,
  initialTab = 'resumo',
  onVoltar,
}) => {
  const {
    matriculas,
    alunos,
    turmas,
    disciplinas,
    periodos,
    orientacoes,
    registrosSemanais,
    documentos,
    avaliacoes,
    feedbacks,
    criterios,
    ocorrencias,
    frequencias,
    turmasOrigem,
    pontosAcompanhamento,
    leiturasResponsaveis,
    getOrigemDoAluno,
    getSituacaoRssEstudante,
    toggleOrientacaoStatus,
    deleteOrientacao,
    deleteFeedback,
    deleteOcorrencia,
    togglePontoStatus,
    deletePontoAcompanhamento,
    updateRegistroSemanal,
    updateDocumento,
    addDocumento,
    updateFrequenciaStatus,
    saveAvaliacao,
  } = useSupervisao();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [modalType, setModalType] = useState<
    'orientacao' | 'feedback' | 'ocorrencia' | 'ponto' | 'documento' | null
  >(null);

  // New Document modal state
  const [novoDocTipo, setNovoDocTipo] = useState('TCLE');
  const [novoDocObs, setNovoDocObs] = useState('');

  // Selected student entities
  const matricula = matriculas.find(m => m.matricula_id === matriculaId);
  const aluno = matricula ? alunos.find(a => a.aluno_id === matricula.aluno_id) : null;
  const turma = matricula ? turmas.find(t => t.turma_id === matricula.turma_id) : null;
  const disciplina = turma ? disciplinas.find(d => d.disciplina_id === turma.disciplina_id) : null;
  const periodo = matricula ? periodos.find(p => p.periodo_id === matricula.periodo_id) : null;

  if (!matricula || !aluno || !turma) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Aluno não encontrado.
        <button onClick={onVoltar} className="block mx-auto mt-3 text-slate-800 underline">
          Voltar
        </button>
      </div>
    );
  }

  // Related data for this student
  const studentOrientacoes = orientacoes.filter(o => o.matricula_id === matriculaId);
  const studentRegistros = registrosSemanais.filter(
    r => r.matricula_id === matriculaId || (aluno && (r.aluno_id === aluno.aluno_id || r.matricula_id === aluno.identificador_academico))
  );
  const studentDocumentos = documentos.filter(
    d => d.matricula_id === matriculaId || (aluno && (d.aluno_id === aluno.aluno_id || d.matricula_id === aluno.identificador_academico))
  );
  const studentAvaliacoes = avaliacoes.filter(
    a => a.matricula_id === matriculaId || (aluno && (a.aluno_id === aluno.aluno_id || a.matricula_id === aluno.identificador_academico))
  );
  const studentFeedbacks = feedbacks.filter(
    f => f.matricula_id === matriculaId || (aluno && (f.aluno_id === aluno.aluno_id || f.matricula_id === aluno.identificador_academico))
  );
  const studentOcorrencias = ocorrencias.filter(
    o => o.matricula_id === matriculaId || (aluno && (o.aluno_id === aluno.aluno_id || o.matricula_id === aluno.identificador_academico))
  );
  const studentFrequencias = frequencias.filter(
    f => f.matricula_id === matriculaId || (aluno && (f.aluno_id === aluno.aluno_id || f.matricula_id === aluno.identificador_academico))
  );
  const studentPontos = pontosAcompanhamento.filter(
    p => p.matricula_id === matriculaId || (aluno && (p.aluno_id === aluno.aluno_id || p.matricula_id === aluno.identificador_academico))
  );

  // Situação canônica de RSS unificada
  const situacaoRss = getSituacaoRssEstudante(matriculaId);
  const totalRegistrosEntregues = situacaoRss?.registrosRealizados ?? studentRegistros.filter(r => r.status === 'ENTREGUE').length;
  const totalRegistrosEsperados = situacaoRss?.registrosEsperadosAteHoje ?? 0;
  const totalPrevistoNoPeriodo = situacaoRss?.totalPrevistoNoPeriodo ?? 12;

  // Docente Online individual do estudante
  const origemDoAluno = getOrigemDoAluno(matriculaId);

  // Estudos Dirigidos / Leituras vinculadas ao estudante
  const estudosTitular = leiturasResponsaveis.filter(l => {
    if (l.responsavel_id === matriculaId || l.aluno_id === aluno.aluno_id) return true;
    if (l.responsaveis_previstos && l.responsaveis_previstos.includes(matriculaId)) return true;
    return false;
  });

  const estudosComoSubstituto = leiturasResponsaveis.filter(l => {
    const isTitular = l.responsavel_id === matriculaId || l.aluno_id === aluno.aluno_id;
    if (isTitular) return false;
    if (l.responsaveis_efetivos && l.responsaveis_efetivos.includes(matriculaId)) return true;
    return false;
  });

  // Metrics
  const docsPendentes = studentDocumentos.filter(d => d.status === 'PENDENTE').length;
  const orientacoesAbertas = studentOrientacoes.filter(o => o.status === 'ABERTA').length;
  const totalAtrasos = studentOcorrencias.filter(o => o.tipo === 'ATRASO').length;
  const totalDispositivos = studentOcorrencias.filter(
    o => o.tipo === 'USO_INADEQUADO_DISPOSITIVO'
  ).length;
  const faltasInjustificadas = studentFrequencias.filter(
    f => f.status === 'FALTA_SEM_JUSTIFICATIVA'
  ).length;

  const ultimaOrientacao = studentOrientacoes
    .slice()
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())[0];

  // Criteria for discipline & calculated grade
  const disciplinaCriterios = criterios.filter(
    c => c.disciplina_id === turma.disciplina_id && c.ativo
  );
  const studentAvaliacoesValidas = studentAvaliacoes.filter(a => a.nota !== null && a.nota !== undefined && String(a.nota).trim() !== '');
  const notaTotal = studentAvaliacoesValidas.reduce((acc, av) => {
    const isDeCriterioAtivo = disciplinaCriterios.some(c => c.criterio_id === av.criterio_id);
    if (!isDeCriterioAtivo) return acc;
    const n = Number(String(av.nota).replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
  const notaTotalNumero = typeof notaTotal === 'number' && !isNaN(notaTotal) ? notaTotal : 0;

  // Build unified chronological history/timeline
  const timelineEvents: {
    id: string;
    data: string;
    titulo: string;
    detalhes: string;
    tipo: 'orientacao' | 'registro' | 'documento' | 'ocorrencia' | 'feedback' | 'frequencia';
  }[] = [];

  studentOrientacoes.forEach(ori => {
    timelineEvents.push({
      id: ori.orientacao_id,
      data: ori.data_hora,
      titulo: `Orientação: ${ori.categoria} (${ori.status})`,
      detalhes: ori.texto,
      tipo: 'orientacao',
    });
  });

  studentRegistros
    .filter(r => r.status === 'ENTREGUE')
    .forEach(reg => {
      timelineEvents.push({
        id: reg.registro_id,
        data: reg.data_entrega || '2026-08-01',
        titulo: `Registro Semanal - Semana ${reg.semana} entregue`,
        detalhes: reg.observacao || 'No prazo',
        tipo: 'registro',
      });
    });

  studentDocumentos
    .filter(d => d.status === 'ENTREGUE')
    .forEach(doc => {
      timelineEvents.push({
        id: doc.documento_id,
        data: doc.data_entrega || '2026-08-01',
        titulo: `Documento entregue: ${doc.tipo}`,
        detalhes: doc.observacao || '',
        tipo: 'documento',
      });
    });

  studentOcorrencias.forEach(oco => {
    timelineEvents.push({
      id: oco.ocorrencia_id,
      data: oco.data_hora,
      titulo: `Ocorrência: ${oco.tipo.replace('_', ' ')}`,
      detalhes: oco.observacao,
      tipo: 'ocorrencia',
    });
  });

  studentFeedbacks.forEach(fb => {
    timelineEvents.push({
      id: fb.feedback_id,
      data: fb.data_hora,
      titulo: `Feedback formativo registrado`,
      detalhes: fb.texto,
      tipo: 'feedback',
    });
  });

  studentFrequencias.forEach(freq => {
    if (freq.status !== 'PRESENTE') {
      timelineEvents.push({
        id: freq.frequencia_id,
        data: freq.data_aula,
        titulo: `Frequência: ${freq.status.replace(/_/g, ' ')}`,
        detalhes: freq.justificativa || 'Aula registrada no Docente Online',
        tipo: 'frequencia',
      });
    }
  });

  timelineEvents.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const tabs = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'pontos', label: 'Pontos de Acompanhamento' },
    { id: 'orientacoes', label: `Orientações (${studentOrientacoes.length})` },
    { id: 'registros', label: `Registros (${totalRegistrosEntregues} de ${totalRegistrosEsperados} esp.)` },
    { id: 'documentos', label: `Documentos (${studentDocumentos.length})` },
    { id: 'avaliacao', label: `Avaliação (${studentAvaliacoesValidas.length > 0 ? notaTotalNumero.toFixed(1) : '—'})` },
    { id: 'estudos', label: `Estudo Dirigido (${estudosTitular.length + estudosComoSubstituto.length})` },
    { id: 'frequencia', label: 'Frequência' },
    { id: 'ocorrencias', label: `Ocorrências (${studentOcorrencias.length})` },
    { id: 'feedback', label: `Feedback (${studentFeedbacks.length})` },
    { id: 'historico', label: 'Histórico' },
  ];

  const handleAddNovoDoc = (e: React.FormEvent) => {
    e.preventDefault();
    addDocumento(matriculaId, novoDocTipo, 'PENDENTE', novoDocObs);
    setNovoDocObs('');
    setModalType(null);
  };

  return (
    <div className="space-y-4">
      {/* Back button & Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{aluno.nome}</h2>
            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
              {aluno.identificador_academico}
            </span>
            {origemDoAluno && (
              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                Docente Online: {origemDoAluno.codigo_externo}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {turma.nome} · {disciplina?.nome} · Turno {turma.turno} · Período {periodo?.nome}
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto shadow-xs">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`
                  px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap
                  ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }
                `}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* 1. RESUMO */}
      {activeTab === 'resumo' && (
        <div className="space-y-4">
          {/* Card Resumo Compacto com Indicadores Clicáveis */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Resumo Geral do Aluno
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <button
                onClick={() => setActiveTab('registros')}
                className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] text-slate-500">Registros Semanais (RSS)</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {totalRegistrosEntregues}
                  <span className="text-slate-400 font-normal"> de </span>
                  {totalRegistrosEsperados}
                  <span className="text-[11px] text-slate-400 font-normal"> esp.</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ({totalPrevistoNoPeriodo} previstos no período)
                </div>
              </button>

              <button
                onClick={() => setActiveTab('documentos')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  docsPendentes > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] text-slate-500">Documentação</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {docsPendentes === 0 ? '0' : docsPendentes}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {docsPendentes > 0 ? '⚠ Pendentes' : 'Em dia'}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('orientacoes')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  orientacoesAbertas > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] text-slate-500">Orientações Abertas</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {orientacoesAbertas}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {orientacoesAbertas > 0 ? 'Em curso' : 'Concluídas'}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('ocorrencias')}
                className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] text-slate-500">Atrasos</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {totalAtrasos}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Registrados</div>
              </button>

              <button
                onClick={() => setActiveTab('ocorrencias')}
                className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] text-slate-500">Uso Dispositivos</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {totalDispositivos}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Ocorrências</div>
              </button>

              <button
                onClick={() => setActiveTab('frequencia')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  faltasInjustificadas > 0 ? 'border-red-200 bg-red-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] text-slate-500">Faltas Injustificadas</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {faltasInjustificadas}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Docente Online</div>
              </button>
            </div>

            {ultimaOrientacao && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Última orientação registrada:</span>
                <span className="font-medium text-slate-800">
                  {new Date(ultimaOrientacao.data_hora).toLocaleDateString('pt-BR')} (
                  {ultimaOrientacao.categoria})
                </span>
              </div>
            )}
          </div>

          {/* Pontos de Acompanhamento no Resumo */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Pontos de Acompanhamento Formativo Ativos
              </h3>
              <button
                onClick={() => setModalType('ponto')}
                className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Ponto</span>
              </button>
            </div>

            {studentPontos.filter(p => p.status === 'ATIVO').length === 0 ? (
              <p className="text-xs text-slate-400">
                Nenhum ponto de acompanhamento ativo cadastrado.
              </p>
            ) : (
              <div className="space-y-2">
                {studentPontos
                  .filter(p => p.status === 'ATIVO')
                  .map(p => (
                    <div
                      key={p.ponto_id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePontoStatus(p.ponto_id)}
                          className="w-4 h-4 rounded border border-slate-300 bg-white hover:border-slate-500 flex items-center justify-center cursor-pointer"
                        />
                        <span className="font-medium text-slate-800">{p.texto}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {p.prioridade && `Prioridade ${p.prioridade}`} · {p.data_criacao}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PONTOS DE ACOMPANHAMENTO TAB */}
      {activeTab === 'pontos' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Acompanhamento Formativo do Estagiário
              </h3>
              <p className="text-xs text-slate-500">
                Metas, objetivos e aspectos acadêmicos a serem acompanhados pelo supervisor.
              </p>
            </div>
            <button
              onClick={() => setModalType('ponto')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Ponto</span>
            </button>
          </div>

          <div className="space-y-2">
            {studentPontos.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nenhum ponto registrado ainda.
              </p>
            ) : (
              studentPontos.map(p => {
                const isConcluido = p.status === 'CONCLUIDO';
                return (
                  <div
                    key={p.ponto_id}
                    className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                      isConcluido
                        ? 'bg-slate-50/60 border-slate-200 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePontoStatus(p.ponto_id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                          isConcluido
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-300 hover:border-slate-500'
                        }`}
                        title={isConcluido ? 'Reabrir ponto' : 'Marcar como concluído'}
                      >
                        {isConcluido && <Check className="w-3 h-3" />}
                      </button>
                      <div>
                        <span className={`font-medium ${isConcluido ? 'line-through' : ''}`}>
                          {p.texto}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Criado em {p.data_criacao}{' '}
                          {p.data_conclusao && `· Concluído em ${p.data_conclusao}`}{' '}
                          {p.prioridade && `· Prioridade: ${p.prioridade}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePontoStatus(p.ponto_id)}
                        className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        {isConcluido ? 'Reabrir' : 'Concluir'}
                      </button>
                      <button
                        onClick={() => deletePontoAcompanhamento(p.ponto_id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Excluir ponto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. ORIENTAÇÕES TAB */}
      {activeTab === 'orientacoes' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Orientações de Supervisão</h3>
              <p className="text-xs text-slate-500">Histórico de intervenções e alinhamentos.</p>
            </div>
            <button
              onClick={() => setModalType('orientacao')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Orientação</span>
            </button>
          </div>

          <div className="space-y-3">
            {studentOrientacoes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nenhuma orientação registrada para este aluno.
              </p>
            ) : (
              studentOrientacoes.map(ori => {
                const isAberta = ori.status === 'ABERTA';
                const dataFmt = new Date(ori.data_hora).toLocaleString('pt-BR');
                return (
                  <div
                    key={ori.orientacao_id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{ori.categoria}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-mono text-[11px]">{dataFmt}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            isAberta
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {isAberta ? 'ABERTA' : 'CONCLUÍDA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleOrientacaoStatus(ori.orientacao_id)}
                          className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
                        >
                          {isAberta ? 'Concluir' : 'Reabrir'}
                        </button>
                        <button
                          onClick={() => deleteOrientacao(ori.orientacao_id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ori.texto}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. REGISTROS SEMANAIS TAB (Visual 1 a 12) */}
      {activeTab === 'registros' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registros Semanais de Estágio (RSS)</h3>
              <p className="text-xs text-slate-500">
                Acompanhamento das entregas semanais: {totalRegistrosEntregues} realizadas de {totalRegistrosEsperados} esperadas até hoje ({totalPrevistoNoPeriodo} no total do período).
              </p>
            </div>
            <div className="text-xs font-bold font-mono text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg">
              {totalRegistrosEntregues} de {totalRegistrosEsperados} esp. ({totalPrevistoNoPeriodo} previstos)
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(semana => {
              const reg = studentRegistros.find(r => r.semana === semana);
              const status = reg ? reg.status : 'PENDENTE_REVISAO';
              const isEntregue = status === 'ENTREGUE';
              const isFaltante = status === 'FALTANTE';

              return (
                <div
                  key={semana}
                  className={`p-3 rounded-xl border text-xs flex flex-col justify-between h-28 transition-colors ${
                    isEntregue
                      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                      : isFaltante
                      ? 'border-red-200 bg-red-50/40 text-red-950'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Semana {semana}</span>
                    {isEntregue ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isFaltante ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="text-[11px] my-1">
                    {isEntregue ? (
                      <span className="text-emerald-700 font-semibold">Entregue</span>
                    ) : isFaltante ? (
                      <span className="text-red-700 font-semibold">Faltante</span>
                    ) : (
                      <span className="text-slate-400">Pendente</span>
                    )}
                    {reg?.data_entrega && (
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {reg.data_entrega}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 border-t border-slate-200/60 pt-1.5">
                    <button
                      onClick={() =>
                        updateRegistroSemanal(
                          matriculaId,
                          semana,
                          isEntregue ? 'PENDENTE_REVISAO' : 'ENTREGUE',
                          reg?.observacao || ''
                        )
                      }
                      className="w-full py-1 text-[10px] font-semibold rounded bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer text-center"
                    >
                      {isEntregue ? 'Desfazer' : 'Marcar Entregue'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. DOCUMENTOS TAB */}
      {activeTab === 'documentos' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Documentação Individual</h3>
              <p className="text-xs text-slate-500">
                Termos, fichas de estágio e documentos regulatórios.
              </p>
            </div>
            <button
              onClick={() => setModalType('documento')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Documento</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {studentDocumentos.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Nenhum documento cadastrado.
              </div>
            ) : (
              studentDocumentos.map(doc => {
                const isEntregue = doc.status === 'ENTREGUE';
                const isPendente = doc.status === 'PENDENTE';
                return (
                  <div
                    key={doc.documento_id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs bg-white"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{doc.tipo}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            isEntregue
                              ? 'bg-emerald-100 text-emerald-900'
                              : isPendente
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      {doc.observacao && (
                        <p className="text-slate-500 text-[11px] mt-0.5">{doc.observacao}</p>
                      )}
                      {doc.data_entrega && (
                        <p className="text-slate-400 text-[10px] mt-0.5 font-mono">
                          Entregue em: {doc.data_entrega}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateDocumento(
                            doc.documento_id,
                            isEntregue ? 'PENDENTE' : 'ENTREGUE',
                            doc.observacao
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        {isEntregue ? 'Marcar Pendente' : 'Marcar Entregue'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 6. AVALIAÇÃO TAB (Critérios configuráveis) */}
      {activeTab === 'avaliacao' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Avaliação de Desempenho no Estágio
              </h3>
              <p className="text-xs text-slate-500">
                Critérios configurados para {disciplina?.nome}.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Nota Total</span>
              <span className="text-lg font-bold font-mono text-slate-900">
                {studentAvaliacoesValidas.length > 0 ? `${notaTotalNumero.toFixed(1)} / 10.0` : '—'}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {disciplinaCriterios.map(crit => {
              const avaliacao = studentAvaliacoes.find(a => a.criterio_id === crit.criterio_id);
              const normNota = avaliacao ? normalizarNota(avaliacao.nota) : 'ausente';
              const notaExibicao = normNota === 'ausente' || normNota === 'invalido' ? '' : normNota;
              const maxNota = typeof crit.nota_maxima === 'number' ? crit.nota_maxima : (parseFloat(String(crit.nota_maxima).replace(',', '.')) || 0);

              return (
                <div
                  key={crit.criterio_id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{crit.nome}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        (Máx: {maxNota.toFixed(1)})
                      </span>
                    </div>
                    {avaliacao?.observacao && (
                      <p className="text-slate-500 text-[11px]">{avaliacao.observacao}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={maxNota}
                      value={notaExibicao}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') {
                          saveAvaliacao(
                            matriculaId,
                            crit.criterio_id,
                            null as any,
                            avaliacao?.observacao || ''
                          );
                        } else {
                          const val = parseFloat(raw.replace(',', '.'));
                          saveAvaliacao(
                            matriculaId,
                            crit.criterio_id,
                            Math.min(isNaN(val) ? 0 : val, maxNota),
                            avaliacao?.observacao || ''
                          );
                        }
                      }}
                      className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <span className="text-slate-400 text-xs">/ {maxNota.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. FREQUÊNCIA TAB */}
      {activeTab === 'frequencia' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registro de Frequência</h3>
              <p className="text-xs text-slate-500">
                Integração e espelhamento com códigos do Docente Online.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
              Faltas s/ justificativa: {faltasInjustificadas}
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {studentFrequencias.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Nenhum registro de frequência lançado para este aluno.
              </div>
            ) : (
              studentFrequencias.map(freq => {
                const origem = turmasOrigem.find(o => o.origem_id === freq.origem_id);
                return (
                  <div
                    key={freq.frequencia_id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {freq.data_aula}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            freq.status === 'PRESENTE'
                              ? 'bg-emerald-100 text-emerald-900'
                              : freq.status === 'FALTA_JUSTIFICADA'
                              ? 'bg-blue-100 text-blue-900'
                              : freq.status === 'JUSTIFICATIVA_PENDENTE'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {freq.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {origem && (
                        <p className="text-slate-400 text-[10px] mt-0.5">
                          Origem: {origem.sistema} ({origem.codigo_externo})
                        </p>
                      )}
                      {freq.justificativa && (
                        <p className="text-slate-600 text-[11px] mt-0.5">
                          Justificativa: {freq.justificativa}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={freq.status}
                        onChange={e =>
                          updateFrequenciaStatus(
                            freq.frequencia_id,
                            e.target.value as any,
                            freq.justificativa
                          )
                        }
                        className="border border-slate-200 rounded-lg p-1.5 text-xs bg-slate-50 text-slate-800 focus:outline-none"
                      >
                        <option value="PRESENTE">Presente</option>
                        <option value="FALTA_SEM_JUSTIFICATIVA">Falta s/ justificativa</option>
                        <option value="FALTA_JUSTIFICADA">Falta justificada</option>
                        <option value="JUSTIFICATIVA_PENDENTE">Justificativa pendente</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 8. OCORRÊNCIAS TAB */}
      {activeTab === 'ocorrencias' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ocorrências Disciplinares</h3>
              <p className="text-xs text-slate-500">
                Atrasos, uso inadequado de dispositivos e outros apontamentos.
              </p>
            </div>
            <button
              onClick={() => setModalType('ocorrencia')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Ocorrência</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {studentOcorrencias.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nenhuma ocorrência registrada.
              </p>
            ) : (
              studentOcorrencias.map(oco => (
                <div
                  key={oco.ocorrencia_id}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{oco.tipo.replace('_', ' ')}</span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(oco.data_hora).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{oco.observacao}</p>
                  </div>
                  <button
                    onClick={() => deleteOcorrencia(oco.ocorrencia_id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 9. FEEDBACK TAB */}
      {activeTab === 'feedback' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Feedbacks Formativos</h3>
              <p className="text-xs text-slate-500">
                Devolutivas e apontamentos sobre a atuação prática do estudante.
              </p>
            </div>
            <button
              onClick={() => setModalType('feedback')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Feedback</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {studentFeedbacks.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nenhum feedback registrado ainda.
              </p>
            ) : (
              studentFeedbacks.map(fb => (
                <div
                  key={fb.feedback_id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-slate-400 block">
                      {new Date(fb.data_hora).toLocaleString('pt-BR')}
                    </span>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{fb.texto}</p>
                  </div>
                  <button
                    onClick={() => deleteFeedback(fb.feedback_id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ESTUDOS DIRIGIDOS / APRESENTAÇÕES DO ALUNO */}
      {activeTab === 'estudos' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Histórico Formativo de Estudos Dirigidos e Leituras
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Apresentação e discussão de artigos, casos e textos atribuídos ao estudante ou substituídos.
              </p>
            </div>
            <div className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
              Registro Formativo Acadêmico
            </div>
          </div>

          {/* Aviso institucional */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <span className="font-bold text-blue-700 shrink-0">ℹ</span>
            <span>
              A realização, ausência ou substituição em estudo dirigido documenta a trajetória formativa do estudante nesta supervisão e <strong>não gera automaticamente</strong> nota, falta ou ocorrência disciplinar. Qualquer impacto avaliativo segue exclusivamente os critérios de avaliação configurados da disciplina.
            </span>
          </div>

          {/* 1. Estudos em que o estudante foi previsto como titular */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Atividades Previstas como Titular ({estudosTitular.length})
            </h4>

            {estudosTitular.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                Nenhum estudo dirigido atribuído originalmente a este estudante nesta turma.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {estudosTitular.map((est, i) => (
                  <div key={i} className="p-3.5 bg-white hover:bg-slate-50 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {est.tema || est.artigo_leitura || 'Apresentação'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          est.status_realizacao === 'REALIZADO'
                            ? 'bg-emerald-100 text-emerald-900'
                            : est.status_realizacao === 'PARCIAL'
                            ? 'bg-blue-100 text-blue-900'
                            : est.status_realizacao === 'SUBSTITUICAO'
                            ? 'bg-purple-100 text-purple-900'
                            : est.status_realizacao === 'NAO_REALIZADO'
                            ? 'bg-red-100 text-red-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {est.status_realizacao || 'PLANEJADO'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono">
                      Data prevista: {est.data}
                      {est.artigo_leitura && est.tema && ` · Artigo: ${est.artigo_leitura}`}
                    </div>

                    {est.observacao && (
                      <p className="text-[11px] text-slate-600 italic">
                        Observação: {est.observacao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Ocasiões em que substituiu colega */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Ocasiões em que Substituiu Colega ({estudosComoSubstituto.length})
            </h4>

            {estudosComoSubstituto.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                O estudante não realizou substituições de colegas nesta turma.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {estudosComoSubstituto.map((est, i) => (
                  <div key={i} className="p-3.5 bg-purple-50/20 hover:bg-purple-50/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-950">
                        {est.tema || est.artigo_leitura}
                      </span>
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded">
                        Apresentou como Substituto
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Data da apresentação: <strong className="font-mono">{est.data}</strong> · Titular original:{' '}
                      <strong>{est.responsavel_nome || 'Colega'}</strong>
                    </div>
                    {est.motivo_substituicao && (
                      <p className="text-[11px] text-slate-600 italic">
                        Motivo: {est.motivo_substituicao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. HISTÓRICO / TIMELINE */}
      {activeTab === 'historico' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Linha do Tempo Cronológica</h3>
            <p className="text-xs text-slate-500">
              Histórico unificado gerado automaticamente a partir dos registros existentes do aluno.
            </p>
          </div>

          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nenhum evento registrado no histórico.</p>
            ) : (
              timelineEvents.map(evt => (
                <div key={evt.id} className="relative text-xs">
                  <div className="absolute -left-[1.45rem] top-1 w-2.5 h-2.5 rounded-full bg-slate-900 ring-4 ring-white" />
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-bold text-slate-800">{evt.titulo}</span>
                      <span className="font-mono">{new Date(evt.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {evt.detalhes && <p className="text-slate-600">{evt.detalhes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {modalType === 'orientacao' && (
        <ModalNovaOrientacao
          matriculaId={matriculaId}
          alunoNome={aluno.nome}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'feedback' && (
        <ModalNovoFeedback
          matriculaId={matriculaId}
          alunoNome={aluno.nome}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ocorrencia' && (
        <ModalRegistrarOcorrencia
          matriculaId={matriculaId}
          alunoNome={aluno.nome}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ponto' && (
        <ModalNovoPontoAcompanhamento
          matriculaId={matriculaId}
          alunoNome={aluno.nome}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'documento' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Cadastrar Documento</h3>
            <form onSubmit={handleAddNovoDoc} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tipo de Documento</label>
                <select
                  value={novoDocTipo}
                  onChange={e => setNovoDocTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                >
                  <option value="TCLE">TCLE (Termo de Consentimento Livre e Esclarecido)</option>
                  <option value="Termo de Compromisso">Termo de Compromisso de Estágio</option>
                  <option value="Ficha de Matrícula">Ficha de Matrícula / Dados Cadastrais</option>
                  <option value="Declaração da Instituição">Declaração da Instituição Concedente</option>
                  <option value="Relatório de Atendimento">Relatório Inicial de Atividades</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Observações</label>
                <input
                  type="text"
                  value={novoDocObs}
                  onChange={e => setNovoDocObs(e.target.value)}
                  placeholder="Ex: Aguardando assinatura dos responsáveis..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
