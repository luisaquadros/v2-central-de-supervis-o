import React, { useState, useEffect } from 'react';
import { Search, X, User, Users, BookOpen, FileText, CheckSquare, Sparkles, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

interface BuscaGlobalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAluno: (matriculaId: string) => void;
  onNavigateToTurma: (turmaId: string) => void;
  onOpenCaixaEntradaComTexto: (texto: string) => void;
}

export const BuscaGlobalModal: React.FC<BuscaGlobalModalProps> = ({
  isOpen,
  onClose,
  onNavigateToAluno,
  onNavigateToTurma,
  onOpenCaixaEntradaComTexto,
}) => {
  const {
    alunos,
    matriculas,
    turmas,
    gruposPratica,
    leiturasResponsaveis,
    documentos,
    orientacoes,
  } = useSupervisao();

  const [termo, setTermo] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Toggle or open
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const termoNorm = termo.toLowerCase().trim();

  // Resultados
  const alunosFiltrados = termoNorm
    ? alunos.filter(a => a.nome.toLowerCase().includes(termoNorm) || a.identificador_academico.toLowerCase().includes(termoNorm)).slice(0, 5)
    : [];

  const turmasFiltradas = termoNorm
    ? turmas.filter(t => t.nome.toLowerCase().includes(termoNorm)).slice(0, 4)
    : [];

  const gruposFiltrados = termoNorm
    ? gruposPratica.filter(g => (g.nome_grupo || '').toLowerCase().includes(termoNorm)).slice(0, 4)
    : [];

  const leiturasFiltradas = termoNorm
    ? leiturasResponsaveis.filter(l => (l.tema || l.titulo || '').toLowerCase().includes(termoNorm)).slice(0, 4)
    : [];

  const orientacoesFiltradas = termoNorm
    ? orientacoes.filter(o => o.texto.toLowerCase().includes(termoNorm) || o.categoria.toLowerCase().includes(termoNorm)).slice(0, 4)
    : [];

  const isComando = termoNorm.startsWith('registrar') || termoNorm.startsWith('adicionar') || termoNorm.startsWith('falta') || termoNorm.startsWith('orientar');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Buscar aluno, turma, grupo, leitura, orientação ou digite um comando..."
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {termo && (
            <button onClick={() => setTermo('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
            ESC
          </span>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Quick command action */}
          {termoNorm && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-indigo-950 font-medium">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {isComando ? 'Executar comando assistivo:' : 'Registrar na Caixa de Entrada:'}{' '}
                  <strong className="text-indigo-700">"{termo}"</strong>
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenCaixaEntradaComTexto(termo);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
              >
                <span>Processar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Alunos */}
          {alunosFiltrados.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Alunos</div>
              {alunosFiltrados.map(a => {
                const mat = matriculas.find(m => m.aluno_id === a.aluno_id);
                return (
                  <button
                    key={a.aluno_id}
                    onClick={() => {
                      if (mat) {
                        onClose();
                        onNavigateToAluno(mat.matricula_id);
                      }
                    }}
                    className="w-full p-2.5 rounded-lg hover:bg-slate-50 text-left flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-100 group-hover:text-indigo-700">
                        {a.nome[0]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{a.nome}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{a.identificador_academico}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Turmas */}
          {turmasFiltradas.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Turmas</div>
              {turmasFiltradas.map(t => (
                <button
                  key={t.turma_id}
                  onClick={() => {
                    onClose();
                    onNavigateToTurma(t.turma_id);
                  }}
                  className="w-full p-2.5 rounded-lg hover:bg-slate-50 text-left flex items-center justify-between transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{t.nome}</div>
                      <div className="text-[10px] text-slate-400">Turno: {t.turno}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Leituras */}
          {leiturasFiltradas.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Leituras / Textos</div>
              {leiturasFiltradas.map((l, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-800 space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{l.tema || l.titulo || 'Leitura'}</span>
                    <span className="font-mono text-[10px] text-slate-400">{l.data}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Responsável: {l.responsavel_nome || l.responsavel_id || 'Geral'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {termoNorm &&
            alunosFiltrados.length === 0 &&
            turmasFiltradas.length === 0 &&
            gruposFiltrados.length === 0 &&
            leiturasFiltradas.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum registro específico encontrado para "{termo}". Use o botão acima para gravar na Caixa de Entrada.
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
