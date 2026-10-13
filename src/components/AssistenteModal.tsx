import React, { useState } from 'react';
import { X, Sparkles, Send, Bot, User, HelpCircle, ArrowRight } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { responderConsultaProfessora } from '../services/aiParserService';

interface AssistenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery?: (q: string) => void;
}

export const AssistenteModal: React.FC<AssistenteModalProps> = ({ isOpen, onClose }) => {
  const {
    turmas,
    alunos,
    matriculas,
    orientacoes,
    documentos,
    registrosSemanais,
    leiturasResponsaveis,
    statusRssUnidades,
    frequencias,
  } = useSupervisao();

  const [pergunta, setPergunta] = useState('');
  const [historico, setHistorico] = useState<{ de: 'USER' | 'ASSISTANT'; texto: string }[]>([
    {
      de: 'ASSISTANT',
      texto:
        'Olá! Sou sua assistente integrada aos dados oficiais da Central de Supervisão. Posso responder sobre o que resolver hoje, pendências de alunos, orientações abertas e leituras.',
    },
  ]);

  if (!isOpen) return null;

  const handleEnviar = (e?: React.FormEvent, perguntaPronta?: string) => {
    if (e) e.preventDefault();
    const textoConsulta = perguntaPronta || pergunta;
    if (!textoConsulta.trim()) return;

    const novaMensagemUsuario = { de: 'USER' as const, texto: textoConsulta };
    const resposta = responderConsultaProfessora(textoConsulta, {
      turmas,
      alunos,
      matriculas,
      orientacoes,
      documentos,
      registrosSemanais,
      leituras: leiturasResponsaveis,
      statusRssUnidades,
      frequencias,
    });

    setHistorico(prev => [...prev, novaMensagemUsuario, { de: 'ASSISTANT', texto: resposta }]);
    setPergunta('');
  };

  const sugestoesPerguntas = [
    'O que preciso resolver em Adulto hoje?',
    'Quais orientações estão abertas há mais tempo?',
    'Quais alunos têm falta + RSS pendente?',
    'Qual a próxima leitura e responsáveis?',
    'Quem ainda não recebeu feedback?',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col h-[75vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Assistente da Professora</h2>
              <p className="text-xs text-slate-500">Respostas ancoradas estritamente na base oficial conectada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat History */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/50">
          {historico.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.de === 'USER' ? 'justify-end' : 'justify-start'}`}
            >
              {m.de === 'ASSISTANT' && (
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`p-3.5 rounded-2xl text-xs max-w-[85%] whitespace-pre-line leading-relaxed shadow-2xs ${
                  m.de === 'USER'
                    ? 'bg-slate-900 text-white rounded-tr-xs'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                }`}
              >
                {m.texto}
              </div>
            </div>
          ))}
        </div>

        {/* Suggestion Chips */}
        <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {sugestoesPerguntas.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleEnviar(undefined, s)}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-[11px] font-medium text-slate-600 whitespace-nowrap transition-colors cursor-pointer shrink-0"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleEnviar} className="p-3.5 border-t border-slate-200 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={pergunta}
            onChange={e => setPergunta(e.target.value)}
            placeholder="Digite uma pergunta sobre alunos, turmas, leituras ou pendências..."
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
          />
          <button
            type="submit"
            disabled={!pergunta.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
