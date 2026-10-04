import React, { useState } from 'react';
import {
  Award,
  Users,
  CheckCircle,
  Clock,
  Send,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  AlertCircle,
  HelpCircle,
  Save,
  Check,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { TipoInstrumento, StatusDevolutiva, AvaliacaoCompleta, CriterioAvaliacao } from '../types';
import { FeedbackModal } from '../components/FeedbackModal';

export const AvaliacaoView: React.FC = () => {
  const {
    turmas,
    alunos,
    matriculas,
    criterios,
    avaliacoesCompletas,
    salvarAvaliacaoCompleta,
    aprovarDevolutiva,
    registrarEnvioDevolutiva,
    registrarAuditoria,
    getAlunosDaTurma,
    frequencias,
    registrosSemanais,
    documentos,
    ocorrencias,
    feedbacks,
    selectedPeriodoId,
    getCriteriosDaTurma,
  } = useSupervisao();

  // Seleção de Turma e Instrumento
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(turmas[0]?.turma_id || '');
  const turmaAtual = turmas.find(t => t.turma_id === selectedTurmaId);

  // Lista dinâmica de instrumentos presentes em criterios_avaliacao para a turma/disciplina
  const instrumentosDisponiveis = React.useMemo(() => {
    const nomes = new Set<string>();
    criterios.forEach(c => {
      if (c.turma_id === selectedTurmaId || c.disciplina_id === turmaAtual?.disciplina_id || (!c.turma_id && !c.disciplina_id)) {
        const inst = c.instrumento_avaliacao || c.instrumento || 'Instrumento Oficial';
        nomes.add(inst);
      }
    });
    return Array.from(nomes);
  }, [criterios, selectedTurmaId, turmaAtual]);

  const [selectedInstrumentoTipo, setSelectedInstrumentoTipo] = useState<TipoInstrumento>('RUBRICA');
  const [selectedInstrumentoNome, setSelectedInstrumentoNome] = useState(
    instrumentosDisponiveis[0] || 'Instrumento Oficial'
  );

  React.useEffect(() => {
    if (instrumentosDisponiveis.length > 0 && !instrumentosDisponiveis.includes(selectedInstrumentoNome)) {
      setSelectedInstrumentoNome(instrumentosDisponiveis[0]);
    }
  }, [instrumentosDisponiveis, selectedInstrumentoNome]);

  const [activeTab, setActiveTab] = useState<'CORRECAO' | 'DEVOLUTIVAS' | 'FECHAMENTO'>('CORRECAO');

  // Navegação Aluno a Aluno na Tela de Correção Ampla
  const [currentAlunoIndex, setCurrentAlunoIndex] = useState(0);

  // Estados da Tela de Correção Ampla
  const [notaSimplesInput, setNotaSimplesInput] = useState<number>(0);
  const [comentarioSimples, setComentarioSimples] = useState('');
  const [notasCriteriosMap, setNotasCriteriosMap] = useState<Record<string, number>>({});
  const [comentariosCriteriosMap, setComentariosCriteriosMap] = useState<Record<string, string>>({});
  const [pontosFortes, setPontosFortes] = useState('');
  const [pontosDesenvolver, setPontosDesenvolver] = useState('');
  const [comentarioGeral, setComentarioGeral] = useState('');
  const [mostrarEvidencias, setMostrarEvidencias] = useState(false);
  const [modalFeedbackAvaliacao, setModalFeedbackAvaliacao] = useState<AvaliacaoCompleta | null>(null);

  // Alunos da turma selecionada
  const alunosDaTurma = getAlunosDaTurma(selectedTurmaId);
  const currentItem = alunosDaTurma[currentAlunoIndex];

  // Critérios oficiais filtrados por turma, disciplina e instrumento da base (sem substituição hardcoded)
  const criteriosAplicaveis = getCriteriosDaTurma(selectedTurmaId, selectedInstrumentoNome);

  // Nota máxima total
  const notaMaximaInstrumento =
    selectedInstrumentoTipo === 'RUBRICA' || selectedInstrumentoTipo === 'HIBRIDA'
      ? criteriosAplicaveis.reduce((acc, c) => acc + (c.nota_maxima || 0), 0) || 10
      : 10;

  // Carrega ou inicializa a avaliação do aluno atual
  const matriculaAtualId = currentItem?.matricula.matricula_id;
  const avaliacaoExistente = avaliacoesCompletas.find(
    (a: AvaliacaoCompleta) => a.matricula_id === matriculaAtualId && a.instrumento_id === selectedInstrumentoNome
  );

  // Sincroniza campos quando muda de aluno
  React.useEffect(() => {
    if (avaliacaoExistente) {
      setNotaSimplesInput(avaliacaoExistente.nota_final);
      setComentarioGeral(avaliacaoExistente.comentario_geral || '');
      setPontosFortes(avaliacaoExistente.pontos_fortes || '');
      setPontosDesenvolver(avaliacaoExistente.pontos_desenvolver || '');

      const nMap: Record<string, number> = {};
      const cMap: Record<string, string> = {};
      (avaliacaoExistente.notas_criterios || []).forEach((item: any) => {
        nMap[item.criterio_id] = item.nota;
        if (item.comentario) cMap[item.criterio_id] = item.comentario;
      });
      setNotasCriteriosMap(nMap);
      setComentariosCriteriosMap(cMap);
    } else {
      setNotaSimplesInput(0);
      setComentarioGeral('');
      setPontosFortes('');
      setPontosDesenvolver('');
      setNotasCriteriosMap({});
      setComentariosCriteriosMap({});
    }
  }, [matriculaAtualId, selectedInstrumentoNome, avaliacaoExistente]);

  // Soma automática das notas dos critérios
  const somaNotasCriterios = Object.values(notasCriteriosMap).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const notaFinalCalculada =
    selectedInstrumentoTipo === 'RUBRICA' || selectedInstrumentoTipo === 'HIBRIDA'
      ? somaNotasCriterios
      : notaSimplesInput;

  const handleSalvarAvaliacao = async (status: StatusDevolutiva = 'AVALIADA') => {
    if (!currentItem) return;

    const notasCriteriosList = criteriosAplicaveis.map(c => ({
      criterio_id: c.criterio_id,
      criterio_nome: c.nome,
      nota: Number(notasCriteriosMap[c.criterio_id] || 0),
      nota_maxima: c.nota_maxima,
      comentario: comentariosCriteriosMap[c.criterio_id] || '',
    }));

    await salvarAvaliacaoCompleta({
      avaliacao_id: avaliacaoExistente?.avaliacao_id || `av-${Date.now()}-${currentItem.matricula.matricula_id}`,
      matricula_id: currentItem.matricula.matricula_id,
      aluno_id: currentItem.aluno.aluno_id,
      turma_id: selectedTurmaId,
      instrumento_id: selectedInstrumentoNome,
      tipo_instrumento: selectedInstrumentoTipo,
      nota_final: notaFinalCalculada,
      nota_maxima: notaMaximaInstrumento,
      status,
      notas_criterios: notasCriteriosList,
      comentario_geral: comentarioGeral,
      pontos_fortes: pontosFortes,
      pontos_desenvolver: pontosDesenvolver,
      data_avaliacao: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    });

    registrarAuditoria(
      'GRAVAR_AVALIACAO',
      'avaliacoes_completas',
      currentItem.matricula.matricula_id,
      avaliacaoExistente?.nota_final,
      notaFinalCalculada,
      `Avaliação do instrumento ${selectedInstrumentoNome}`
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Central de Avaliação & Devolutivas
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Gestão Acadêmica & Avaliativa
          </h1>
          <p className="text-xs text-slate-500">
            Correção por rubrica, nota simples, evidências e emissão de feedback
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Turma</label>
            <select
              value={selectedTurmaId}
              onChange={e => {
                setSelectedTurmaId(e.target.value);
                setCurrentAlunoIndex(0);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            >
              {turmas.map(t => (
                <option key={t.turma_id} value={t.turma_id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Instrumento</label>
            <select
              value={selectedInstrumentoNome}
              onChange={e => {
                const val = e.target.value;
                setSelectedInstrumentoNome(val);
                if (val.includes('Prova')) setSelectedInstrumentoTipo('NOTA_SIMPLES');
                else if (val.includes('Atividade')) setSelectedInstrumentoTipo('ATIVIDADE_SIMPLES');
                else setSelectedInstrumentoTipo('RUBRICA');
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            >
              <option value="Relatório de Prática">Relatório de Prática (Rubrica)</option>
              <option value="Prova Objetiva 1">Prova Objetiva 1 (Nota Simples)</option>
              <option value="Avaliação Contínua de Supervisão">Supervisão Contínua (Rubrica)</option>
              <option value="Atividade Prática">Atividade Prática (Nota + Comentário)</option>
              <option value="Apresentação de Caso Clínico">Apresentação de Caso (Híbrida)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs Switch */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 gap-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('CORRECAO')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'CORRECAO' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Tela de Correção Ampla</span>
        </button>

        <button
          onClick={() => setActiveTab('DEVOLUTIVAS')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'DEVOLUTIVAS' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>2. Painel de Devolutivas ({alunosDaTurma.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('FECHAMENTO')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'FECHAMENTO' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>3. Modo Fechamento do Semestre</span>
        </button>
      </div>

      {/* TAB 1: TELA DE CORREÇÃO AMPLA */}
      {activeTab === 'CORRECAO' && (
        <div className="space-y-5">
          {/* Sequential Navigation Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                disabled={currentAlunoIndex === 0}
                onClick={() => setCurrentAlunoIndex(prev => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <span className="text-xs font-semibold text-slate-700">
                Estudante <strong className="text-slate-900">{currentAlunoIndex + 1}</strong> de{' '}
                <strong>{alunosDaTurma.length}</strong>
              </span>

              <button
                disabled={currentAlunoIndex >= alunosDaTurma.length - 1}
                onClick={() => setCurrentAlunoIndex(prev => Math.min(alunosDaTurma.length - 1, prev + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Student Info Card */}
            {currentItem && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  {currentItem.aluno.nome[0]}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{currentItem.aluno.nome}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    RA: {currentItem.aluno.identificador_academico}
                  </span>
                </div>
              </div>
            )}

            {/* Preparation of Evidences Action */}
            <button
              onClick={() => setMostrarEvidencias(!mostrarEvidencias)}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>{mostrarEvidencias ? 'Ocultar Evidências' : 'Preparar Avaliação (Evidências)'}</span>
            </button>
          </div>

          {/* Optional Evidences Side-panel / Accordion */}
          {mostrarEvidencias && currentItem && (
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-5 space-y-3 animate-in fade-in duration-100">
              <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Evidências Consolidadas da Base (Sem decisão automática de nota):</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-indigo-100">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Frequência</span>
                  <span className="font-bold text-slate-800">
                    {frequencias.filter(f => f.matricula_id === currentItem.matricula.matricula_id && f.status === 'PRESENTE').length} presenças
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-indigo-100">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">RSS Entregues</span>
                  <span className="font-bold text-slate-800">
                    {registrosSemanais.filter(r => r.matricula_id === currentItem.matricula.matricula_id && r.status === 'ENTREGUE').length} entregas
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-indigo-100">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Documentação</span>
                  <span className="font-bold text-slate-800">
                    {documentos.filter(d => d.matricula_id === currentItem.matricula.matricula_id && d.status === 'ENTREGUE').length} entregues
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-indigo-100">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Ocorrências</span>
                  <span className="font-bold text-slate-800">
                    {ocorrencias.filter(o => o.matricula_id === currentItem.matricula.matricula_id).length} registros
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Main Correction Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Instrumento: {selectedInstrumentoTipo}
                </span>
                <h2 className="text-base font-bold text-slate-900">{selectedInstrumentoNome}</h2>
              </div>

              {/* Automatic Total Score Counter */}
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Nota Total Calculada</span>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {notaFinalCalculada.toFixed(1)}{' '}
                  <span className="text-sm font-normal text-slate-400">/ {notaMaximaInstrumento.toFixed(1)}</span>
                </span>
              </div>
            </div>

            {/* Instrument Type: NOTA SIMPLES */}
            {selectedInstrumentoTipo === 'NOTA_SIMPLES' && (
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 max-w-md">
                <label className="text-xs font-bold text-slate-800 block">Nota Direta (0 a {notaMaximaInstrumento})</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={notaMaximaInstrumento}
                  value={notaSimplesInput}
                  onChange={e => setNotaSimplesInput(parseFloat(e.target.value) || 0)}
                  className="p-3 bg-white border border-slate-200 rounded-xl text-lg font-bold text-slate-900 w-full font-mono"
                />
              </div>
            )}

            {/* Instrument Type: ATIVIDADE SIMPLES */}
            {selectedInstrumentoTipo === 'ATIVIDADE_SIMPLES' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Nota (0 a {notaMaximaInstrumento})</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={notaMaximaInstrumento}
                    value={notaSimplesInput}
                    onChange={e => setNotaSimplesInput(parseFloat(e.target.value) || 0)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-base font-bold text-slate-900 w-48 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Comentário / Parecer Opcional</label>
                  <textarea
                    rows={3}
                    value={comentarioGeral}
                    onChange={e => setComentarioGeral(e.target.value)}
                    placeholder="Observações da entrega..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {/* Instrument Type: RUBRICA OU HÍBRIDA */}
            {(selectedInstrumentoTipo === 'RUBRICA' || selectedInstrumentoTipo === 'HIBRIDA') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider pb-1">
                  <span>Critério de Avaliação</span>
                  <div className="flex items-center gap-12 pr-4">
                    <span>Máximo</span>
                    <span>Nota Atribuída</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {criteriosAplicaveis.map(crit => {
                    const notaCrit = notasCriteriosMap[crit.criterio_id] ?? 0;
                    const obsCrit = comentariosCriteriosMap[crit.criterio_id] ?? '';

                    return (
                      <div key={crit.criterio_id} className="p-4 bg-white space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">{crit.nome}</span>
                            {crit.descricao && <span className="text-[11px] text-slate-500">{crit.descricao}</span>}
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                            <span className="font-mono text-xs font-bold text-slate-400">
                              {crit.nota_maxima.toFixed(1)}
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={crit.nota_maxima}
                              value={notaCrit}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setNotasCriteriosMap(prev => ({ ...prev, [crit.criterio_id]: val }));
                              }}
                              className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold font-mono text-slate-900 text-center"
                            />
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={obsCrit}
                            onChange={e => {
                              const val = e.target.value;
                              setComentariosCriteriosMap(prev => ({ ...prev, [crit.criterio_id]: val }));
                            }}
                            placeholder="Comentário ou evidência específica deste critério..."
                            className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feedback fields: Pontos Fortes, Pontos a Desenvolver, Parecer Geral */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Pontos Fortes Demonstrados</label>
                <textarea
                  rows={2}
                  value={pontosFortes}
                  onChange={e => setPontosFortes(e.target.value)}
                  placeholder="Aspectos em que o estudante se destacou..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Aspectos a Desenvolver</label>
                <textarea
                  rows={2}
                  value={pontosDesenvolver}
                  onChange={e => setPontosDesenvolver(e.target.value)}
                  placeholder="Sugestões de melhoria e foco pedagógico..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleSalvarAvaliacao('RASCUNHO')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
              >
                Salvar Rascunho
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentItem) {
                      setModalFeedbackAvaliacao({
                        avaliacao_id: avaliacaoExistente?.avaliacao_id || `av-${Date.now()}`,
                        matricula_id: currentItem.matricula.matricula_id,
                        turma_id: selectedTurmaId,
                        instrumento_id: selectedInstrumentoNome,
                        tipo_instrumento: selectedInstrumentoTipo,
                        nota_final: notaFinalCalculada,
                        nota_maxima: notaMaximaInstrumento,
                        status: 'AVALIADA',
                        comentario_geral: comentarioGeral,
                        pontos_fortes: pontosFortes,
                        pontos_desenvolver: pontosDesenvolver,
                        atualizado_em: new Date().toISOString(),
                      });
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold cursor-pointer"
                >
                  Gerar Ficha de Devolutiva
                </button>

                <button
                  type="button"
                  onClick={() => handleSalvarAvaliacao('AVALIADA')}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Concluir Avaliação</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAINEL DE DEVOLUTIVAS */}
      {activeTab === 'DEVOLUTIVAS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Painel Geral de Devolutivas por Estudante</h2>
              <p className="text-xs text-slate-500">
                Acompanhe o estado de revisão, aprovação individual e envio de cada feedback
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {alunosDaTurma.map(({ matricula, aluno }) => {
              const av = avaliacoesCompletas.find(
                (a: AvaliacaoCompleta) => a.matricula_id === matricula.matricula_id && a.instrumento_id === selectedInstrumentoNome
              );
              const status: StatusDevolutiva = av ? av.status : 'NAO_INICIADA';

              return (
                <div key={matricula.matricula_id} className="p-4 flex items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{aluno.nome}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      RA: {aluno.identificador_academico}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        status === 'ENVIADO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'APROVADO_ENVIO'
                          ? 'bg-indigo-100 text-indigo-800'
                          : status === 'AVALIADA' || status === 'FEEDBACK_PREPARADO'
                          ? 'bg-blue-100 text-blue-800'
                          : status === 'RASCUNHO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {status.replace(/_/g, ' ')}
                    </span>

                    <button
                      onClick={() => {
                        if (turmaAtual) {
                          setModalFeedbackAvaliacao(
                            av || {
                              avaliacao_id: `av-${Date.now()}`,
                              matricula_id: matricula.matricula_id,
                              turma_id: selectedTurmaId,
                              instrumento_id: selectedInstrumentoNome,
                              tipo_instrumento: selectedInstrumentoTipo,
                              nota_final: 0,
                              nota_maxima: notaMaximaInstrumento,
                              status: 'NAO_INICIADA',
                              atualizado_em: new Date().toISOString(),
                            }
                          );
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                    >
                      Ver / Devolutiva
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MODO FECHAMENTO */}
      {activeTab === 'FECHAMENTO' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Modo Fechamento do Semestre</h2>
            <p className="text-xs text-slate-500">
              Checklist acadêmico por estudante: RSS, frequência, documentação e consolidação final
            </p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {alunosDaTurma.map(({ matricula, aluno }) => {
              const rssCount = registrosSemanais.filter(r => r.matricula_id === matricula.matricula_id && r.status === 'ENTREGUE').length;
              const docsCount = documentos.filter(d => d.matricula_id === matricula.matricula_id && d.status === 'ENTREGUE').length;
              const faltasCount = frequencias.filter(f => f.matricula_id === matricula.matricula_id && f.status === 'FALTA_SEM_JUSTIFICATIVA').length;
              const pronto = rssCount >= 10 && faltasCount === 0;

              return (
                <div key={matricula.matricula_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{aluno.nome}</span>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span>RSS: {rssCount}/12</span>
                      <span>•</span>
                      <span>Documentos: {docsCount}</span>
                      <span>•</span>
                      <span>Faltas Injustificadas: {faltasCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        pronto ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {pronto ? 'Pronto para Fechamento' : 'Revisão Necessária'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {modalFeedbackAvaliacao && currentItem && turmaAtual && (
        <FeedbackModal
          isOpen={true}
          onClose={() => setModalFeedbackAvaliacao(null)}
          avaliacao={modalFeedbackAvaliacao}
          aluno={currentItem.aluno}
          turma={turmaAtual}
        />
      )}
    </div>
  );
};
