import React, { useState } from 'react';
import {
  ArrowLeft,
  Users,
  Clock,
  BookOpen,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Plus,
  Send,
  Sparkles,
  MessageSquare,
  HelpCircle,
  FileText,
  UserCheck,
  UserX,
  ListOrdered,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { ItemFilaSupervisao } from '../types';
import { calcularMetricasCronogramaRss } from '../services/supervisaoOperacionalService';

interface ModoAulaViewProps {
  turmaId: string;
  onEncerrar: () => void;
  onOpenFichaAluno: (matriculaId: string, tab?: string) => void;
  onOpenCaixaEntrada?: (texto?: string) => void;
}

export const ModoAulaView: React.FC<ModoAulaViewProps> = ({
  turmaId,
  onEncerrar,
  onOpenFichaAluno,
  onOpenCaixaEntrada,
}) => {
  const {
    turmas,
    getAlunosDaTurma,
    frequencias,
    addFrequencia,
    updateFrequenciaStatus,
    orientacoes,
    addOrientacao,
    toggleOrientacaoStatus,
    pontosAcompanhamento,
    togglePontoStatus,
    leiturasResponsaveis,
    gruposPratica,
    grupoIntegrantes,
    calendarioRss,
    situacaoAtualTurmas,
    regrasRss,
    statusRssUnidades,
    marcosAcademicos,
    isTurmaClinicaAmpliada,
    filaSupervisao,
    addItemFilaSupervisao,
    updateStatusFilaSupervisao,
    removerItemFilaSupervisao,
  } = useSupervisao();

  const turma = turmas.find(t => t.turma_id === turmaId);
  const alunosDaTurma = getAlunosDaTurma(turmaId);
  const hojeStr = new Date().toISOString().split('T')[0];

  // Identifica Clínica Ampliada pelo modelo relacional / grupos de prática (sem substring)
  const isClinicaAmpliada = isTurmaClinicaAmpliada(turmaId);
  const gruposDaTurma = gruposPratica.filter(g => g.turma_id === turmaId);

  // Leitura do encontro vinculada à turma e data (sem fallback por índice)
  const leitura = leiturasResponsaveis.find(l => l.turma_id === turmaId && (l.data || '') >= hojeStr) ||
    leiturasResponsaveis.find(l => l.turma_id === turmaId) ||
    null;

  // Semana de prática e RSS esperados da turma (sem fallbacks hardcoded, filtragem estrita por turma_id)
  const metricasCronograma = React.useMemo(() => {
    return calcularMetricasCronogramaRss(turmaId, calendarioRss, situacaoAtualTurmas, hojeStr);
  }, [turmaId, calendarioRss, situacaoAtualTurmas, hojeStr]);

  const semanaPraticaTexto = metricasCronograma.semanaTexto;
  const rssEsperadosTexto = metricasCronograma.semanasEncerradasTexto;
  const regraTurma = regrasRss.find(r => r.turma_id === turmaId || r.disciplina_id === turma?.disciplina_id);
  const totalRssEsperado = regraTurma?.total_esperado ? Number(regraTurma.total_esperado) : 0;

  // Próximos marcos
  const marcosDaTurma = marcosAcademicos.filter(m => m.turma_id === turmaId || !m.turma_id);

  // Sub-abas do Modo Aula
  const [subTab, setSubTab] = useState<'CHAMADA' | 'FILA' | 'ORIENTACOES' | 'PONTOS_ANTERIORES'>('CHAMADA');

  // Estado para registro rápido de orientação nesta aula
  const [orientacaoAlvoTipo, setOrientacaoAlvoTipo] = useState<'ALUNO' | 'GRUPO' | 'TURMA'>('ALUNO');
  const [orientacaoAlvoId, setOrientacaoAlvoId] = useState('');
  const [orientacaoTexto, setOrientacaoTexto] = useState('');
  const [orientacaoRetomarProxima, setOrientacaoRetomarProxima] = useState(false);
  const [gravandoOrientacao, setGravandoOrientacao] = useState(false);

  // Estado para adicionar na Fila de Supervisão
  const [filaAlvoTipo, setFilaAlvoTipo] = useState<'ALUNO' | 'GRUPO'>('ALUNO');
  const [filaAlvoId, setFilaAlvoId] = useState('');
  const [filaAssunto, setFilaAssunto] = useState('');

  if (!turma) return <div>Turma não encontrada.</div>;

  // Frequência de hoje
  const getFrequenciaHoje = (matriculaId: string) => {
    return frequencias.find(f => f.matricula_id === matriculaId && f.data_aula === hojeStr);
  };

  const handleMarcarPresenca = async (
    matriculaId: string,
    status: 'PRESENTE' | 'FALTA_SEM_JUSTIFICATIVA' | 'FALTA_JUSTIFICADA' | 'JUSTIFICATIVA_PENDENTE'
  ) => {
    const freqExistente = getFrequenciaHoje(matriculaId);
    if (freqExistente) {
      await updateFrequenciaStatus(freqExistente.frequencia_id, status);
    } else {
      await addFrequencia(matriculaId, hojeStr, status, '');
    }
  };

  // Itens da Fila de Supervisão desta turma
  const itensFilaTurma = filaSupervisao.filter(f => f.turma_id === turmaId);

  const handleAdicionarFila = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filaAlvoId || !filaAssunto.trim()) return;

    let nomeAlvo = '';
    if (filaAlvoTipo === 'ALUNO') {
      const a = alunosDaTurma.find(item => item.aluno.aluno_id === filaAlvoId);
      nomeAlvo = a ? a.aluno.nome : 'Estudante';
    } else {
      const g = gruposDaTurma.find(item => item.grupo_id === filaAlvoId);
      nomeAlvo = g ? g.nome_grupo || 'Grupo' : 'Grupo';
    }

    addItemFilaSupervisao({
      turma_id: turmaId,
      alvo_tipo: filaAlvoTipo,
      alvo_id: filaAlvoId,
      nome_alvo: nomeAlvo,
      assunto: filaAssunto.trim(),
    });
    setFilaAssunto('');
  };

  const handleSalvarOrientacaoRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orientacaoTexto.trim()) return;

    setGravandoOrientacao(true);
    try {
      if (orientacaoAlvoTipo === 'ALUNO' && orientacaoAlvoId) {
        const a = alunosDaTurma.find(item => item.aluno.aluno_id === orientacaoAlvoId);
        if (a) {
          await addOrientacao(
            a.matricula.matricula_id,
            orientacaoRetomarProxima ? 'Retomar na Próxima' : 'Supervisão',
            orientacaoTexto.trim(),
            'ABERTA'
          );
        }
      } else {
        // Para grupo ou turma, registra para a primeira matrícula representativa ou caixa de entrada
        const primeiraMat = alunosDaTurma[0]?.matricula.matricula_id;
        if (primeiraMat) {
          await addOrientacao(
            primeiraMat,
            orientacaoAlvoTipo === 'GRUPO' ? 'Grupo de Prática' : 'Turma Geral',
            `[${orientacaoAlvoTipo}]: ${orientacaoTexto.trim()}`,
            'ABERTA'
          );
        }
      }
      setOrientacaoTexto('');
      setOrientacaoRetomarProxima(false);
    } catch (err: any) {
      alert('Erro ao gravar orientação: ' + err.message);
    } finally {
      setGravandoOrientacao(false);
    }
  };

  // Pontos de acompanhamento da aula anterior abertos
  const matriculaIdsTurma = new Set(alunosDaTurma.map(a => a.matricula.matricula_id));
  const pontosAbertos = pontosAcompanhamento.filter(
    p => matriculaIdsTurma.has(p.matricula_id) && p.status === 'ATIVO'
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header Operational Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Modo Aula Ativo • Supervisão em Andamento
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <span>{turma.nome}</span>
            {isClinicaAmpliada && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                Clínica Ampliada (Grupos de Prática)
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-medium">
            <span>Data: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></span>
            <span>•</span>
            <span>Semana de Prática: <strong>{semanaPraticaTexto}</strong></span>
            <span>•</span>
            <span>RSS Esperados até Agora: <strong>{rssEsperadosTexto}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenCaixaEntrada && (
            <button
              onClick={() => onOpenCaixaEntrada()}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>+ Registro Rápido</span>
            </button>
          )}

          <button
            onClick={onEncerrar}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Encerrar Supervisão</span>
          </button>
        </div>
      </div>

      {/* Meeting Reading & Discussion Banner */}
      {leitura && (
        <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block">
                Leitura do Encontro: "{leitura.tema || leitura.titulo || 'Sem título'}"
              </span>
              <span className="text-slate-500">
                Responsáveis: <strong className="text-indigo-800">{leitura.responsavel_nome || leitura.responsavel_id || 'Turma em geral'}</strong>
              </span>
            </div>
          </div>
          {marcosDaTurma[0] && (
            <div className="text-slate-500 font-medium">
              Próximo Marco: <strong className="text-slate-800">{marcosDaTurma[0].nome}</strong> ({marcosDaTurma[0].data_prazo})
            </div>
          )}
        </div>
      )}

      {/* Internal Navigation Sub-tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 gap-1 shadow-2xs">
        <button
          onClick={() => setSubTab('CHAMADA')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'CHAMADA' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>A. Chamada & Presença</span>
        </button>

        <button
          onClick={() => setSubTab('FILA')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'FILA' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>B. Fila de Supervisão ({itensFilaTurma.length})</span>
        </button>

        <button
          onClick={() => setSubTab('ORIENTACOES')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'ORIENTACOES' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>C. Registro de Orientações</span>
        </button>

        <button
          onClick={() => setSubTab('PONTOS_ANTERIORES')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'PONTOS_ANTERIORES' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>D. Retomar Aula Anterior ({pontosAbertos.length})</span>
        </button>
      </div>

      {/* Tab A: Chamada & Presença Rápida */}
      {subTab === 'CHAMADA' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Lista de Presença em Tempo Real</h2>
              <p className="text-xs text-slate-500">Clique para atualizar a frequência instantaneamente</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">{alunosDaTurma.length} matriculados</span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {alunosDaTurma.map(({ matricula, aluno }) => {
              const freq = getFrequenciaHoje(matricula.matricula_id);
              const statusFreq = freq ? freq.status : 'SEM_REGISTRO';

              return (
                <div
                  key={matricula.matricula_id}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center">
                      {aluno.nome[0]}
                    </div>
                    <div>
                      <button
                        onClick={() => onOpenFichaAluno(matricula.matricula_id, 'frequencia')}
                        className="font-bold text-xs text-slate-900 hover:text-indigo-600 cursor-pointer text-left"
                      >
                        {aluno.nome}
                      </button>
                      <div className="text-[10px] text-slate-400 font-mono">{aluno.identificador_academico}</div>
                    </div>
                  </div>

                  {/* Presence State Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => handleMarcarPresenca(matricula.matricula_id, 'PRESENTE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statusFreq === 'PRESENTE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      Presente
                    </button>
                    <button
                      onClick={() => handleMarcarPresenca(matricula.matricula_id, 'FALTA_SEM_JUSTIFICATIVA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statusFreq === 'FALTA_SEM_JUSTIFICATIVA'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      Falta
                    </button>
                    <button
                      onClick={() => handleMarcarPresenca(matricula.matricula_id, 'JUSTIFICATIVA_PENDENTE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statusFreq === 'JUSTIFICATIVA_PENDENTE'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      Justificativa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab B: Fila de Supervisão */}
      {subTab === 'FILA' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Fila de Supervisão Clínica</h2>
            <p className="text-xs text-slate-500">Organize os casos e apresentações a serem discutidos no encontro</p>
          </div>

          {/* Form to add item to queue */}
          <form onSubmit={handleAdicionarFila} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Destino</label>
                <select
                  value={filaAlvoTipo}
                  onChange={e => {
                    setFilaAlvoTipo(e.target.value as any);
                    setFilaAlvoId('');
                  }}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="ALUNO">Estudante Individual</option>
                  {isClinicaAmpliada && <option value="GRUPO">Grupo de Prática</option>}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Nome</label>
                <select
                  value={filaAlvoId}
                  onChange={e => setFilaAlvoId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Selecione...</option>
                  {filaAlvoTipo === 'ALUNO'
                    ? alunosDaTurma.map(a => (
                        <option key={a.aluno.aluno_id} value={a.aluno.aluno_id}>
                          {a.aluno.nome}
                        </option>
                      ))
                    : gruposDaTurma.map(g => (
                        <option key={g.grupo_id} value={g.grupo_id}>
                          {g.nome_grupo || 'Grupo'}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Assunto / Caso a Discutir</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filaAssunto}
                    onChange={e => setFilaAssunto(e.target.value)}
                    placeholder="Ex: Formulação de caso, manejo de resistência..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!filaAlvoId || !filaAssunto.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Queue items */}
          <div className="space-y-2">
            {itensFilaTurma.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum caso ou estudante na fila de discussão ainda.
              </div>
            ) : (
              itensFilaTurma.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{item.nome_alvo}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {item.alvo_tipo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">"{item.assunto}"</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={e => updateStatusFilaSupervisao(item.id, e.target.value as any)}
                      className="p-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50"
                    >
                      <option value="AGUARDANDO">Aguardando</option>
                      <option value="EM_DISCUSSAO">Em Discussão</option>
                      <option value="ORIENTACAO_REGISTRADA">Orientação Registrada</option>
                      <option value="CONCLUIDO">Concluído</option>
                    </select>

                    <button
                      onClick={() => removerItemFilaSupervisao(item.id)}
                      className="text-slate-400 hover:text-red-600 text-xs p-1 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab C: Orientações */}
      {subTab === 'ORIENTACOES' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Registro Rápido de Orientações da Supervisão</h2>
            <p className="text-xs text-slate-500">Grave orientações com a opção de retomar automaticamente na próxima aula</p>
          </div>

          <form onSubmit={handleSalvarOrientacaoRapida} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Destinatário</label>
                <select
                  value={orientacaoAlvoTipo}
                  onChange={e => setOrientacaoAlvoTipo(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="ALUNO">Estudante Específico</option>
                  {isClinicaAmpliada && <option value="GRUPO">Grupo de Prática</option>}
                  <option value="TURMA">Turma Toda</option>
                </select>
              </div>

              {orientacaoAlvoTipo === 'ALUNO' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Selecione o Estudante</label>
                  <select
                    value={orientacaoAlvoId}
                    onChange={e => setOrientacaoAlvoId(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">Selecione...</option>
                    {alunosDaTurma.map(a => (
                      <option key={a.aluno.aluno_id} value={a.aluno.aluno_id}>
                        {a.aluno.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Texto da Orientação</label>
              <textarea
                rows={3}
                value={orientacaoTexto}
                onChange={e => setOrientacaoTexto(e.target.value)}
                placeholder="Ex: Aprofundar a hipótese diagnóstica; alinhar sigilo com o paciente..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-indigo-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orientacaoRetomarProxima}
                  onChange={e => setOrientacaoRetomarProxima(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Retomar este ponto na próxima supervisão</span>
              </label>

              <button
                type="submit"
                disabled={gravandoOrientacao || !orientacaoTexto.trim()}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {gravandoOrientacao ? 'Gravando...' : 'Gravar Orientação'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab D: Retomar Aula Anterior */}
      {subTab === 'PONTOS_ANTERIORES' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pontos de Acompanhamento em Aberto</h2>
            <p className="text-xs text-slate-500">Itens registrados em supervisões passadas aguardando resolução</p>
          </div>

          <div className="space-y-2">
            {pontosAbertos.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum ponto em aberto trazido da aula anterior.
              </div>
            ) : (
              pontosAbertos.map(p => {
                const a = alunosDaTurma.find(item => item.matricula.matricula_id === p.matricula_id);

                return (
                  <div
                    key={p.ponto_id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePontoStatus(p.ponto_id)}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{a?.aluno.nome || 'Estudante'}</div>
                        <div className="text-xs text-slate-600 mt-0.5">"{p.texto}"</div>
                      </div>
                    </div>

                    <button
                      onClick={() => togglePontoStatus(p.ponto_id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold cursor-pointer"
                    >
                      Marcar Resolvido
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
