import React from 'react';
import { X, Play, BookOpen, AlertTriangle, Clock, Users, CheckCircle, FileText, Calendar } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Turma } from '../types';

interface PrepararAulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  turma: Turma;
  onIniciarModoAula: (turmaId: string) => void;
}

export const PrepararAulaModal: React.FC<PrepararAulaModalProps> = ({
  isOpen,
  onClose,
  turma,
  onIniciarModoAula,
}) => {
  const {
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    leiturasResponsaveis,
    orientacoes,
    marcosAcademicos,
    documentos,
    pontosAcompanhamento,
    gruposPratica,
  } = useSupervisao();

  if (!isOpen) return null;

  const alunosDaTurma = getAlunosDaTurma(turma.turma_id);

  // Alunos com atenção
  const alunosComAtencao = alunosDaTurma
    .map(a => getResumoAlunoSupervisao(a.matricula.matricula_id))
    .filter((res): res is NonNullable<typeof res> => res !== null && res.temAtencao);

  // Orientações abertas
  const matriculaIdsTurma = new Set(alunosDaTurma.map(a => a.matricula.matricula_id));
  const orientacoesAbertas = orientacoes.filter(
    o => matriculaIdsTurma.has(o.matricula_id) && o.status === 'ABERTA'
  );

  // Próxima leitura
  const hojeStr = new Date().toISOString().split('T')[0];
  const proximasLeituras = leiturasResponsaveis.filter(
    l => l.turma_id === turma.turma_id || !l.turma_id
  );
  const leitura = proximasLeituras[0];

  // Documentos pendentes
  const docsPendentes = documentos.filter(
    d => matriculaIdsTurma.has(d.matricula_id) && d.status === 'PENDENTE'
  );

  // Próximos prazos
  const proximosMarcos = marcosAcademicos.filter(
    m => m.turma_id === turma.turma_id || !m.turma_id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                Briefing Estruturado
              </span>
              <span className="text-xs text-slate-500 font-medium">Preparação de Supervisão</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">{turma.nome}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* 1. Leitura do Encontro */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold">
              <BookOpen className="w-4 h-4" />
              <span>Leitura & Discussão Teórica</span>
            </div>
            {leitura ? (
              <div className="pl-6 space-y-1">
                <div className="font-bold text-slate-900 text-xs">{leitura.tema || leitura.titulo || 'Sem título'}</div>
                <div className="text-slate-500">
                  Responsáveis: <strong className="text-slate-800">{leitura.responsavel_nome || leitura.responsavel_id || 'Turma em geral'}</strong>
                </div>
                {leitura.data && <div className="text-[11px] text-slate-400">Data programada: {leitura.data}</div>}
              </div>
            ) : (
              <div className="pl-6 text-slate-400">Nenhuma leitura programada especificamente.</div>
            )}
          </div>

          {/* 2. Pessoas que precisam de atenção imediata */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
            <div className="flex items-center justify-between text-amber-900 font-bold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Casos para Atenção Nesta Aula ({alunosComAtencao.length})</span>
              </div>
            </div>
            {alunosComAtencao.length === 0 ? (
              <div className="pl-6 text-slate-500">Nenhum estudante em situação de prioridade.</div>
            ) : (
              <div className="pl-6 space-y-1.5">
                {alunosComAtencao.slice(0, 5).map(res => (
                  <div key={res.aluno.aluno_id} className="flex items-start justify-between">
                    <div>
                      <strong className="text-slate-900">{res.aluno.nome}</strong>
                      <span className="text-slate-500 block text-[11px]">
                        {res.motivosAtencao.join(' • ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Orientações em Aberto para Retomar */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Orientações da Supervisão Anterior para Retomar ({orientacoesAbertas.length})</span>
            </div>
            {orientacoesAbertas.length === 0 ? (
              <div className="pl-6 text-slate-400">Nenhuma orientação pendente de acompanhamento.</div>
            ) : (
              <div className="pl-6 space-y-2">
                {orientacoesAbertas.slice(0, 4).map(o => {
                  const mat = alunosDaTurma.find(a => a.matricula.matricula_id === o.matricula_id);
                  return (
                    <div key={o.orientacao_id} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="font-bold text-slate-800">{mat?.aluno.nome} ({o.categoria})</div>
                      <div className="text-slate-600 mt-0.5">"{o.texto}"</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Documentos e Prazos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Documentação Pendente</span>
              <span className="text-sm font-bold text-slate-900">{docsPendentes.length} pendência(s)</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Próximo Marco Acadêmico</span>
              <span className="text-sm font-bold text-slate-900">
                {proximosMarcos[0] ? proximosMarcos[0].nome : 'Em dia'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer with action */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Fechar Briefing
          </button>
          <button
            onClick={() => {
              onClose();
              onIniciarModoAula(turma.turma_id);
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Iniciar Supervisão / Modo Aula</span>
          </button>
        </div>
      </div>
    </div>
  );
};
