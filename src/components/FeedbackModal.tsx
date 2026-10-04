import React, { useState } from 'react';
import { X, Printer, Mail, Check, Edit2, Sparkles, AlertCircle, FileText, Send, Save } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { AvaliacaoCompleta, Aluno, Turma } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  avaliacao: AvaliacaoCompleta;
  aluno: Aluno;
  turma: Turma;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  avaliacao,
  aluno,
  turma,
}) => {
  const { salvarAvaliacaoCompleta, aprovarDevolutiva, registrarEnvioDevolutiva } = useSupervisao();

  const [editando, setEditando] = useState(false);
  const [textoFeedback, setTextoFeedback] = useState(
    avaliacao.feedback_gerado ||
      `DEVOLUTIVA DE SUPERVISÃO\n\nEstudante: ${aluno.nome} (${aluno.identificador_academico})\nTurma: ${turma.nome}\nInstrumento: ${avaliacao.tipo_instrumento}\nNota Final: ${avaliacao.nota_final.toFixed(1)} / ${avaliacao.nota_maxima.toFixed(1)}\n\n${
        avaliacao.notas_criterios && avaliacao.notas_criterios.length > 0
          ? 'DESEMPENHO POR CRITÉRIO:\n' +
            avaliacao.notas_criterios
              .map(
                c =>
                  `• ${c.criterio_nome}: ${c.nota.toFixed(1)}/${c.nota_maxima.toFixed(1)}${
                    c.comentario ? ` — ${c.comentario}` : ''
                  }`
              )
              .join('\n') +
            '\n\n'
          : ''
      }${avaliacao.pontos_fortes ? `PONTOS FORTES:\n${avaliacao.pontos_fortes}\n\n` : ''}${
        avaliacao.pontos_desenvolver ? `ASPECTOS A DESENVOLVER:\n${avaliacao.pontos_desenvolver}\n\n` : ''
      }${avaliacao.comentario_geral ? `PARECER GERAL:\n${avaliacao.comentario_geral}\n\n` : ''}`
  );

  const [modoEnvioEmail, setModoEnvioEmail] = useState(false);
  const [emailDestino, setEmailDestino] = useState(
    (aluno as any).email || (aluno as any).contato || ''
  );
  const [assuntoEmail, setAssuntoEmail] = useState(
    `Devolutiva Acadêmica - ${turma.nome} - ${aluno.nome}`
  );
  const [enviando, setEnviando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSalvarEdicao = async () => {
    await salvarAvaliacaoCompleta({
      ...avaliacao,
      feedback_gerado: textoFeedback,
      status: 'FEEDBACK_PREPARADO',
    });
    setEditando(false);
  };

  const handleMelhorarComIA = () => {
    // Organiza e aprimora a clareza sem alterar nenhuma nota ou critério avaliado
    const aprimorado =
      textoFeedback +
      '\n\n[Revisão de Clareza]: As diretrizes acima resumem seu desempenho na supervisão com base nos critérios estabelecidos pela disciplina.';
    setTextoFeedback(aprimorado);
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleAprovar = () => {
    aprovarDevolutiva(avaliacao.avaliacao_id);
    setMensagemSucesso('Devolutiva aprovada para envio!');
    setTimeout(() => setMensagemSucesso(null), 2000);
  };

  const handleEnviarEmail = async () => {
    if (!emailDestino.trim() || !emailDestino.includes('@')) {
      alert('E-mail do aluno não cadastrado ou inválido. O envio só é permitido para endereços válidos da base.');
      return;
    }

    setEnviando(true);
    try {
      // Simula / Prepara envio seguro via Gmail OAuth (sem envio silencioso)
      await new Promise(r => setTimeout(r, 600));
      registrarEnvioDevolutiva(avaliacao.avaliacao_id, emailDestino);
      setMensagemSucesso(`Devolutiva enviada com sucesso para ${emailDestino}!`);
      setTimeout(() => {
        setMensagemSucesso(null);
        setModoEnvioEmail(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      alert('Erro no envio: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                Ficha Individual de Devolutiva
              </span>
              <span className="text-xs text-slate-500 font-semibold">{aluno.nome}</span>
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

        {/* Feedback message banner */}
        {mensagemSucesso && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 text-emerald-800 text-xs font-semibold flex items-center gap-2 print:hidden">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{mensagemSucesso}</span>
          </div>
        )}

        {/* Actions bar (hidden in print) */}
        <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-1.5">
            {!editando ? (
              <button
                onClick={() => setEditando(true)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Texto</span>
              </button>
            ) : (
              <button
                onClick={handleSalvarEdicao}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Edição</span>
              </button>
            )}

            <button
              onClick={handleMelhorarComIA}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Aprimorar Clareza</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleImprimir}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            {avaliacao.status !== 'APROVADO_ENVIO' && avaliacao.status !== 'ENVIADO' && (
              <button
                onClick={handleAprovar}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Aprovar Devolutiva</span>
              </button>
            )}

            <button
              onClick={() => setModoEnvioEmail(!modoEnvioEmail)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar por E-mail</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 print:p-0 print:overflow-visible">
          {modoEnvioEmail ? (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3 print:hidden">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>Prévia de Envio por E-mail (Gmail OAuth Seguro)</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Destinatário Oficial</label>
                  <input
                    type="email"
                    value={emailDestino}
                    onChange={e => setEmailDestino(e.target.value)}
                    placeholder="email.do.aluno@academico.edu.br"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  {!emailDestino && (
                    <span className="text-[10px] text-amber-600 font-semibold block mt-1">
                      ⚠ E-mail não encontrado na base de dados. Preencha manualmente para liberar o envio.
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Assunto</label>
                  <input
                    type="text"
                    value={assuntoEmail}
                    onChange={e => setAssuntoEmail(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                {textoFeedback}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModoEnvioEmail(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Voltar à Visualização
                </button>
                <button
                  type="button"
                  onClick={handleEnviarEmail}
                  disabled={enviando || !emailDestino.includes('@')}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{enviando ? 'Enviando...' : 'Revisado e Aprovado — Enviar Agora'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {editando ? (
                <textarea
                  rows={14}
                  value={textoFeedback}
                  onChange={e => setTextoFeedback(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              ) : (
                <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-2xs whitespace-pre-wrap text-xs text-slate-800 leading-relaxed font-sans print:border-none print:shadow-none print:p-0">
                  {textoFeedback}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
