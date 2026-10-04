import React, { useState } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  MessageSquare,
  FileCheck,
  CalendarCheck,
  ChevronRight,
  ArrowLeft,
  X,
  FileText,
  UserCheck,
  Check,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import {
  ModalNovaOrientacao,
  ModalNovoFeedback,
  ModalRegistrarOcorrencia,
  ModalNovoPontoAcompanhamento,
} from '../components/Modals';

interface ModoSupervisaoViewProps {
  turmaId: string;
  onEncerrar: () => void;
  onOpenFichaAluno: (matriculaId: string, initialTab?: string) => void;
}

export const ModoSupervisaoView: React.FC<ModoSupervisaoViewProps> = ({
  turmaId,
  onEncerrar,
  onOpenFichaAluno,
}) => {
  const {
    turmas,
    disciplinas,
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    toggleOrientacaoStatus,
    togglePontoStatus,
  } = useSupervisao();

  const turma = turmas.find(t => t.turma_id === turmaId);
  const disciplina = disciplinas.find(d => d.disciplina_id === turma?.disciplina_id);
  const alunosLista = getAlunosDaTurma(turmaId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatriculaId, setSelectedMatriculaId] = useState<string>(() => {
    return alunosLista.length > 0 ? alunosLista[0].matricula.matricula_id : '';
  });

  // Modal states
  const [modalType, setModalType] = useState<
    'orientacao' | 'feedback' | 'atraso' | 'ocorrencia' | 'ponto' | null
  >(null);

  // Filter students
  const filteredAlunos = alunosLista.filter(item =>
    item.aluno.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Current selected student summary
  const resumoAluno = selectedMatriculaId ? getResumoAlunoSupervisao(selectedMatriculaId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-2.5rem)] -m-4 sm:-m-6 bg-slate-100 overflow-hidden">
      {/* Top Header of Modo Supervisão */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onEncerrar}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Encerrar Modo Supervisão"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                Modo Supervisão
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {disciplina?.nome} · {turma?.turno}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">{turma?.nome}</h2>
          </div>
        </div>

        <button
          onClick={onEncerrar}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
        >
          Encerrar Supervisão
        </button>
      </header>

      {/* Main Split Screen Area (Tablet Landscape 30% / 70%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUNA ESQUERDA: LISTA DE ALUNOS (30% - min 260px, max 340px) */}
        <div className="w-1/3 min-w-[260px] max-w-[340px] bg-white border-r border-slate-200 flex flex-col shrink-0">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar aluno na turma..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Student Clean List: ONLY Name and ⚠ indicator */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredAlunos.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum aluno encontrado.
              </div>
            ) : (
              filteredAlunos.map(item => {
                const isSelected = item.matricula.matricula_id === selectedMatriculaId;
                const resumo = getResumoAlunoSupervisao(item.matricula.matricula_id);
                const hasAlert = resumo?.temAtencao;

                return (
                  <button
                    key={item.matricula.matricula_id}
                    onClick={() => setSelectedMatriculaId(item.matricula.matricula_id)}
                    className={`
                      w-full px-4 py-3 text-left flex items-center justify-between transition-colors cursor-pointer select-none
                      ${
                        isSelected
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }
                    `}
                  >
                    <span className="text-xs truncate mr-2">{item.aluno.nome}</span>

                    {/* ONLY discreet ⚠ when attention is needed */}
                    {hasAlert && (
                      <span
                        className={`text-xs shrink-0 font-bold ${
                          isSelected ? 'text-amber-400' : 'text-amber-500'
                        }`}
                        title="Possui pendências ou itens que requerem atenção"
                      >
                        ⚠
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ÁREA DIREITA: FICHA RESUMIDA DO ALUNO SELECIONADO (70%) */}
        <div className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-4">
          {!resumoAluno ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Selecione um aluno na coluna à esquerda para iniciar o atendimento.
            </div>
          ) : (
            <div className="max-w-4xl space-y-4">
              {/* 1. CABEÇALHO DO ALUNO */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {resumoAluno.aluno.nome}
                    </h3>
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {resumoAluno.aluno.identificador_academico}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {resumoAluno.turma.nome} · {resumoAluno.disciplina.nome} · Turno {resumoAluno.turma.turno}
                  </p>
                </div>

                <button
                  onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'resumo')}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <span>Abrir Ficha Completa</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 2. RESUMO COMPACTO (INDICADORES CLICÁVEIS) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Resumo do Estágio (Clique para detalhar)
                  </span>
                  {resumoAluno.temAtencao && (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <span>⚠ Itens precisam de atenção</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Registros */}
                  <button
                    onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'registros')}
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] text-slate-500">Registros Semanais</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                      {resumoAluno.totalRegistrosEntregues} / {resumoAluno.totalRegistrosEsperados}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">
                      {resumoAluno.totalRegistrosEntregues >= 8 ? 'No ritmo esperado' : 'Revisar entregas'}
                    </div>
                  </button>

                  {/* Documentos */}
                  <button
                    onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'documentos')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      resumoAluno.docsPendentesCount > 0
                        ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] text-slate-500">Documentação</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                      {resumoAluno.docsPendentesCount === 0
                        ? 'Regular'
                        : `${resumoAluno.docsPendentesCount} pendente`}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {resumoAluno.docsPendentesCount > 0 ? '⚠ TCLE / Termos' : 'Tudo entregue'}
                    </div>
                  </button>

                  {/* Faltas Injustificadas */}
                  <button
                    onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'frequencia')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      resumoAluno.faltasInjustificadasCount > 0
                        ? 'border-red-200 bg-red-50/40 hover:bg-red-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] text-slate-500">Faltas s/ Justificativa</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                      {resumoAluno.faltasInjustificadasCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {resumoAluno.faltasInjustificadasCount > 0 ? '⚠ Docente Online' : 'Sem faltas graves'}
                    </div>
                  </button>

                  {/* Orientações Abertas */}
                  <button
                    onClick={() => onOpenFichaAluno(resumoAluno.matricula.matricula_id, 'orientacoes')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      resumoAluno.orientacoesAbertasCount > 0
                        ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] text-slate-500">Orientações Abertas</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                      {resumoAluno.orientacoesAbertasCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {resumoAluno.orientacoesAbertasCount > 0 ? 'Aguardando retorno' : 'Todas resolvidas'}
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. PONTOS DE ACOMPANHAMENTO ATIVOS (Formativo/acadêmico) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-900 tracking-tight">
                      Pontos de Acompanhamento Formativo
                    </span>
                  </div>
                  <button
                    onClick={() => setModalType('ponto')}
                    className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Ponto</span>
                  </button>
                </div>

                {resumoAluno.pontosAtivos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhum ponto de acompanhamento ativo no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumoAluno.pontosAtivos.map(ponto => (
                      <div
                        key={ponto.ponto_id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => togglePontoStatus(ponto.ponto_id)}
                            className="mt-0.5 w-4 h-4 rounded border border-slate-300 hover:border-slate-500 bg-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Marcar como concluído"
                          >
                            {ponto.status === 'CONCLUIDO' && (
                              <Check className="w-3 h-3 text-emerald-600" />
                            )}
                          </button>
                          <div>
                            <span className="text-slate-800 font-medium leading-relaxed">
                              {ponto.texto}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Criado em {ponto.data_criacao}{' '}
                              {ponto.prioridade && `· Prioridade ${ponto.prioridade}`}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => togglePontoStatus(ponto.ponto_id)}
                          className="text-[11px] text-slate-600 hover:text-emerald-700 shrink-0 font-medium cursor-pointer"
                        >
                          Concluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. ÚLTIMAS ORIENTAÇÕES REGISTRADAS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 tracking-tight">
                    Últimas Orientações da Supervisão
                  </span>
                  <button
                    onClick={() => setModalType('orientacao')}
                    className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Orientação</span>
                  </button>
                </div>

                {resumoAluno.ultimasOrientacoes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhuma orientação registrada para este aluno ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumoAluno.ultimasOrientacoes.map(ori => {
                      const isAberta = ori.status === 'ABERTA';
                      const dataFormatada = new Date(ori.data_hora).toLocaleDateString('pt-BR');

                      return (
                        <div
                          key={ori.orientacao_id}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{ori.categoria}</span>
                              <span className="text-[10px] text-slate-400">· {dataFormatada}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  isAberta
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isAberta ? 'Aberta' : 'Concluída'}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{ori.texto}</p>
                          </div>

                          <button
                            onClick={() => toggleOrientacaoStatus(ori.orientacao_id)}
                            className="text-[11px] text-slate-500 hover:text-slate-900 shrink-0 font-medium underline cursor-pointer"
                          >
                            {isAberta ? 'Marcar Concluída' : 'Reabrir'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. AÇÕES RÁPIDAS (Botões Grandes para Tablet em Sala) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                  Ações Rápidas em Sala
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => setModalType('orientacao')}
                    className="p-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Orientação</span>
                  </button>

                  <button
                    onClick={() => setModalType('feedback')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                    <span>+ Feedback</span>
                  </button>

                  <button
                    onClick={() => setModalType('atraso')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <Clock className="w-4 h-4 text-slate-600" />
                    <span>Registrar Atraso</span>
                  </button>

                  <button
                    onClick={() => setModalType('ocorrencia')}
                    className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Ocorrência</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {modalType === 'orientacao' && (
        <ModalNovaOrientacao
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'feedback' && (
        <ModalNovoFeedback
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'atraso' && (
        <ModalRegistrarOcorrencia
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          tipoInicial="ATRASO"
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ocorrencia' && (
        <ModalRegistrarOcorrencia
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          tipoInicial="USO_INADEQUADO_DISPOSITIVO"
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === 'ponto' && (
        <ModalNovoPontoAcompanhamento
          matriculaId={selectedMatriculaId}
          alunoNome={resumoAluno?.aluno.nome || ''}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
};
