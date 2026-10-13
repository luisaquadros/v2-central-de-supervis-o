import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileText } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { quadroDeDocumentos, resumirDocumentosDaTurma, frasesDeDocumentosFaltando } from '../services/documentacaoAcademicaService';

/**
 * Documentos da turma: quantos alunos ainda não entregaram cada um (Manual, Termo...) e, fora do Modo Aula,
 * um quadro com o check "entregue / não entregue" por aluno. É consulta: não gera pendência nem notificação.
 */
export const ResumoDocumentosTurma: React.FC<{ turmaId: string; compacto?: boolean; comQuadro?: boolean }> = ({ turmaId, compacto = false, comQuadro = false }) => {
  const { entregas, getAlunosDaTurma, marcarEntrega } = useSupervisao();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const alunos = getAlunosDaTurma(turmaId);
  const ids = useMemo(() => alunos.map(a => a.matricula.matricula_id), [alunos]);
  const resumo = useMemo(() => resumirDocumentosDaTurma(entregas, new Set(ids)), [entregas, ids]);
  if (!resumo.length) return null;

  const frases = frasesDeDocumentosFaltando(resumo);
  const tudoCerto = frases.length === 0;
  const quadro = comQuadro && aberto ? quadroDeDocumentos(entregas, ids) : null;
  const nomeDe = new Map(alunos.map(a => [a.matricula.matricula_id, a.aluno.nome]));

  const alternar = async (matriculaId: string, tipo: string, entregue: boolean) => {
    const chave = `${matriculaId}|${tipo}`;
    setSalvando(chave); setErro('');
    try { await marcarEntrega(matriculaId, tipo, entregue); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSalvando(null); }
  };

  return (
    <div data-testid="resumo-documentos-turma"
      className={`rounded-xl border ${compacto ? 'px-3 py-2' : 'p-3.5'} text-sm ${tudoCerto ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' : 'border-sky-200 bg-sky-50/50 text-sky-900'}`}>
      <div className="flex items-start gap-2 font-semibold">
        {tudoCerto ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <FileText className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />}
        <div className="flex-1">
          <span>Documentos: </span>
          {tudoCerto ? <span>todos os alunos entregaram.</span> : <span className="font-normal block sm:inline">{frases.join(' · ')}</span>}
        </div>
        {comQuadro && (
          <button type="button" onClick={() => setAberto(v => !v)}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 min-h-[32px] rounded-lg border border-sky-300 bg-white text-sky-800">
            <ClipboardCheck className="w-3.5 h-3.5" /> {aberto ? 'Fechar quadro' : 'Marcar entregas'}
          </button>
        )}
      </div>
      {!compacto && resumo.some(r => r.aConferir > 0) && (
        <p className="text-xs text-slate-600 mt-1">{resumo.filter(r => r.aConferir > 0).map(r => `${r.aConferir} a conferir (${r.rotulo})`).join(' · ')}</p>
      )}
      {quadro && (
        <div className="mt-3 overflow-x-auto bg-white rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left px-2 py-1.5 font-semibold">Estudante</th>
                {quadro.tipos.map(t => <th key={t.tipo} className="px-2 py-1.5 font-semibold text-center">{t.rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {quadro.linhas.map(l => (
                <tr key={l.matriculaId} className="border-t border-slate-100">
                  <td className="px-2 py-1 text-slate-800">{nomeDe.get(l.matriculaId)}</td>
                  {l.celulas.map(c => (
                    <td key={c.tipo} className="px-2 py-1 text-center">
                      {c.situacao === 'NAO_SE_APLICA'
                        ? <span className="text-slate-400">n/a</span>
                        : <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={c.marcado}
                            disabled={salvando === `${l.matriculaId}|${c.tipo}`}
                            aria-label={`${nomeDe.get(l.matriculaId)}: ${quadro.tipos.find(t => t.tipo === c.tipo)?.rotulo} entregue`}
                            title={c.situacao === 'A_CONFERIR' ? 'A conferir' : undefined}
                            onChange={e => alternar(l.matriculaId, c.tipo, e.target.checked)} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <p role="alert" className="text-xs text-red-700 mt-1">{erro}</p>}
    </div>
  );
};
