import React, { useState } from 'react';
import { X, Sparkles, Send, Check, AlertTriangle, Clock, User, Users, Calendar, MessageSquare, Layers } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { classificarTextoLivre, SugestaoCaixaEntrada } from '../services/aiParserService';

interface CaixaEntradaGlobalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
}

export const CaixaEntradaGlobalModal: React.FC<CaixaEntradaGlobalModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
}) => {
  const {
    alunos,
    turmas,
    matriculas,
    gruposPratica,
    addCaixaEntradaItem,
    addOrientacao,
    addFrequencia,
    addOcorrencia,
    addDocumento,
    addFeedback,
    addItemFilaProfessora,
  } = useSupervisao();

  const [modo, setModo] = useState<'TEXTO_LIVRE' | 'ESTRUTURADO'>('TEXTO_LIVRE');
  const [textoLivre, setTextoLivre] = useState(initialText);
  const [sugestoes, setSugestoes] = useState<SugestaoCaixaEntrada[]>([]);
  const [analisado, setAnalisado] = useState(false);

  // Campos do modo estruturado manual
  const [formAlunoId, setFormAlunoId] = useState('');
  const [formTurmaId, setFormTurmaId] = useState('');
  const [formGrupoId, setFormGrupoId] = useState('');
  const [formTipo, setFormTipo] = useState('JUSTIFICATIVA_FALTA');
  const [formData, setFormData] = useState(new Date().toISOString().split('T')[0]);
  const [formCanal, setFormCanal] = useState('WhatsApp');
  const [formObservacao, setFormObservacao] = useState('');
  const [gravando, setGravando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalisarTexto = () => {
    if (!textoLivre.trim()) return;
    const resultado = classificarTextoLivre(textoLivre, alunos, turmas, gruposPratica);
    setSugestoes(resultado.sugestoes);
    setAnalisado(true);
  };

  const handleConfirmarSugestao = async (sugestao: SugestaoCaixaEntrada) => {
    setGravando(true);
    try {
      let targetMatriculaId = '';
      if (sugestao.alunoId) {
        const mat = matriculas.find(m => m.aluno_id === sugestao.alunoId);
        if (mat) targetMatriculaId = mat.matricula_id;
      }

      // Roteia a gravação para a tabela normalizada correta
      if (sugestao.tipo === 'JUSTIFICATIVA_FALTA' && targetMatriculaId) {
        await addFrequencia(targetMatriculaId, sugestao.dataRelacionada, 'JUSTIFICATIVA_PENDENTE', sugestao.observacao);
      } else if (sugestao.tipo === 'FALTA' && targetMatriculaId) {
        await addFrequencia(targetMatriculaId, sugestao.dataRelacionada, 'FALTA_SEM_JUSTIFICATIVA', '');
      } else if (sugestao.tipo === 'ATRASO' && targetMatriculaId) {
        await addOcorrencia(targetMatriculaId, 'ATRASO', sugestao.observacao);
      } else if (sugestao.tipo === 'USO_CELULAR' && targetMatriculaId) {
        await addOcorrencia(targetMatriculaId, 'USO_INADEQUADO_DISPOSITIVO', sugestao.observacao);
      } else if (sugestao.tipo === 'ORIENTACAO' && targetMatriculaId) {
        await addOrientacao(targetMatriculaId, 'Geral', sugestao.observacao, 'ABERTA');
      } else if (sugestao.tipo === 'DOCUMENTO_ENTREGUE' && targetMatriculaId) {
        await addDocumento(targetMatriculaId, 'Termo de Compromisso', 'ENTREGUE', sugestao.observacao);
      } else {
        // Registra como item classificado na Caixa de Entrada do app
        addCaixaEntradaItem({
          texto_original: textoLivre,
          status: 'CONFIRMADO',
          tipo_sugerido: sugestao.tipo,
          aluno_id: sugestao.alunoId,
          matricula_id: targetMatriculaId,
          grupo_id: sugestao.grupoId,
          turma_id: sugestao.turmaId,
          data_relacionada: sugestao.dataRelacionada,
          observacao: sugestao.observacao,
          canal: sugestao.canal,
        });
      }

      setMensagemSucesso('Registro confirmado e gravado com sucesso!');
      setTimeout(() => {
        setMensagemSucesso(null);
        onClose();
      }, 1400);
    } catch (err: any) {
      alert('Erro ao gravar: ' + (err?.message || 'Falha na gravação.'));
    } finally {
      setGravando(false);
    }
  };

  const handleSalvarComoPendente = () => {
    addCaixaEntradaItem({
      texto_original: textoLivre,
      status: 'PENDENTE',
      motivo_pendente: 'Salvo manualmente na Caixa de Entrada para resolução posterior.',
      observacao: textoLivre,
      data_relacionada: new Date().toISOString().split('T')[0],
    });
    setMensagemSucesso('Item enviado para a Caixa de Entrada Pendente.');
    setTimeout(() => {
      setMensagemSucesso(null);
      onClose();
    }, 1200);
  };

  const handleGravarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formObservacao.trim()) {
      alert('Por favor, informe a descrição ou observação.');
      return;
    }

    setGravando(true);
    try {
      let targetMatriculaId = '';
      if (formAlunoId) {
        const mat = matriculas.find(m => m.aluno_id === formAlunoId);
        if (mat) targetMatriculaId = mat.matricula_id;
      }

      if (formTipo === 'JUSTIFICATIVA_FALTA' && targetMatriculaId) {
        await addFrequencia(targetMatriculaId, formData, 'JUSTIFICATIVA_PENDENTE', formObservacao);
      } else if (formTipo === 'ORIENTACAO' && targetMatriculaId) {
        await addOrientacao(targetMatriculaId, 'Geral', formObservacao, 'ABERTA');
      } else if (formTipo === 'TAREFA_PROFESSORA') {
        addItemFilaProfessora({
          titulo: formObservacao,
          categoria: 'Geral',
          duracao_minutos: 15,
          prioridade: 'MEDIA',
          status: 'PENDENTE',
          turma_id: formTurmaId || undefined,
          matricula_id: targetMatriculaId || undefined,
          prazo: formData,
        });
      } else {
        addCaixaEntradaItem({
          texto_original: formObservacao,
          status: 'CONFIRMADO',
          tipo_sugerido: formTipo,
          aluno_id: formAlunoId || undefined,
          matricula_id: targetMatriculaId || undefined,
          grupo_id: formGrupoId || undefined,
          turma_id: formTurmaId || undefined,
          data_relacionada: formData,
          observacao: formObservacao,
          canal: formCanal,
        });
      }

      setMensagemSucesso('Registro manual gravado com sucesso!');
      setTimeout(() => {
        setMensagemSucesso(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      alert('Erro ao gravar: ' + (err?.message || 'Falha'));
    } finally {
      setGravando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              +
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Caixa de Entrada / Registro Rápido Global</h2>
              <p className="text-xs text-slate-500">Alimente o sistema de qualquer tela sem navegar antes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 gap-1.5">
          <button
            onClick={() => setModo('TEXTO_LIVRE')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              modo === 'TEXTO_LIVRE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Texto Livre (Assistivo)</span>
          </button>
          <button
            onClick={() => setModo('ESTRUTURADO')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              modo === 'ESTRUTURADO' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Registro Estruturado Manual</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {mensagemSucesso && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{mensagemSucesso}</span>
          </div>
        )}

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {modo === 'TEXTO_LIVRE' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Digite ou cole a informação exatamente como recebeu:
                </label>
                <textarea
                  rows={3}
                  value={textoLivre}
                  onChange={e => {
                    setTextoLivre(e.target.value);
                    setAnalisado(false);
                  }}
                  placeholder="Ex: 'Ana justificou a falta de quinta porque estava doente.' ou 'Larissa entregou o termo de compromisso.'"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleAnalisarTexto}
                  disabled={!textoLivre.trim() || gravando}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interpretar Informação</span>
                </button>

                <button
                  type="button"
                  onClick={handleSalvarComoPendente}
                  disabled={!textoLivre.trim() || gravando}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardar para depois (Pendente)</span>
                </button>
              </div>

              {/* Sugestões geradas */}
              {analisado && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Sugestões Identificadas (Confirme antes de gravar):</span>
                  </h3>

                  {sugestoes.map((sug, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-600 text-white">
                          {sug.tipoLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Canal: {sug.canal || 'Manual'}
                        </span>
                      </div>

                      {sug.ambiguo && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Atenção para confirmação:</span> {sug.motivoAmbiguidade}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Estudante Proposto</span>
                          <span className="font-bold text-slate-900">{sug.alunoNome || 'Não identificado (escolha abaixo)'}</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Data Relacionada</span>
                          <span className="font-bold text-slate-900">{sug.dataRelacionada}</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                        <span className="text-slate-400 block text-[10px] mb-0.5">Observação extraída</span>
                        {sug.observacao}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmarSugestao(sug)}
                          disabled={gravando}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirmar e Gravar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleGravarManual} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Registro</label>
                  <select
                    value={formTipo}
                    onChange={e => setFormTipo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="JUSTIFICATIVA_FALTA">Justificativa de Falta</option>
                    <option value="ATRASO">Atraso em Aula/Supervisão</option>
                    <option value="FALTA">Registro de Falta</option>
                    <option value="ORIENTACAO">Orientação Acadêmica</option>
                    <option value="FEEDBACK">Feedback Individual</option>
                    <option value="DOCUMENTO_ENTREGUE">Entrega de Documento</option>
                    <option value="USO_CELULAR">Uso Inadequado de Celular</option>
                    <option value="PONTO_PROXIMA_AULA">Ponto para Próxima Aula</option>
                    <option value="SITUACAO_GRUPO">Situação de Grupo de Prática</option>
                    <option value="NOTA_FUTURA_AVALIACAO">Anotação para Avaliação</option>
                    <option value="TAREFA_PROFESSORA">Tarefa da Professora</option>
                    <option value="CONTATO_ALUNO">Contato do Aluno</option>
                    <option value="ANOTACAO_GERAL">Anotação Geral</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Data Relacionada</label>
                  <input
                    type="date"
                    value={formData}
                    onChange={e => setFormData(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Estudante (Opcional)</label>
                  <select
                    value={formAlunoId}
                    onChange={e => setFormAlunoId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="">Selecione se aplicável...</option>
                    {alunos.map(a => (
                      <option key={a.aluno_id} value={a.aluno_id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Turma (Opcional)</label>
                  <select
                    value={formTurmaId}
                    onChange={e => setFormTurmaId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="">Selecione se aplicável...</option>
                    {turmas.map(t => (
                      <option key={t.turma_id} value={t.turma_id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição / Observação</label>
                <textarea
                  rows={3}
                  value={formObservacao}
                  onChange={e => setFormObservacao(e.target.value)}
                  placeholder="Detalhes do registro..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={gravando || !formObservacao.trim()}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {gravando ? 'Gravando...' : 'Gravar Registro'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
