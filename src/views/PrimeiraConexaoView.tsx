import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

export const PrimeiraConexaoView: React.FC = () => {
  const { loginGoogle, connectionErrorMessage, connectionStatus } = useSupervisao();
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const isCarregando = loading || connectionStatus === 'CARREGANDO';

  const handleConectar = async () => {
    if (isCarregando) return;
    setLoading(true);
    setErrorLocal(null);
    try { await loginGoogle(); }
    catch (err: unknown) {
      setErrorLocal(err instanceof Error ? err.message : 'Não foi possível iniciar a sessão.');
    } finally { setLoading(false); }
  };

  return (
    <div className="cs-login-shell min-h-[100dvh] flex items-center justify-center p-4 sm:p-8">
      <div className="cs-login-frame w-full max-w-5xl overflow-hidden grid lg:grid-cols-[1.06fr_0.94fr]">
        <section className="cs-login-story relative overflow-hidden p-8 sm:p-12 flex flex-col justify-between gap-12" aria-label="Apresentação da Central">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.12em] uppercase font-bold text-white/80">
              <img src="/central-supervisao.svg" alt="" aria-hidden="true" className="w-10 h-10 rounded-2xl bg-white/15 p-1" />
              <span>Central de Supervisão</span>
            </div>
            <div className="mt-14 max-w-md">
              <span className="cs-login-eyebrow inline-flex items-center gap-2"><Sparkles size={14} aria-hidden="true" /> Seu espaço de trabalho</span>
              <h1 className="text-4xl sm:text-[2.9rem] font-extrabold tracking-[-0.045em] leading-[1.14] mt-5">
                Menos abas abertas.<br /><span className="text-teal-200">Mais clareza</span> para supervisionar.
              </h1>
              <p className="text-white/75 text-sm sm:text-base leading-relaxed mt-5 max-w-sm">
                Turmas, aulas, acompanhamento e documentos reunidos em um único lugar, com organização e cuidado.
              </p>
            </div>
          </div>
          <div className="relative z-10 grid gap-3 sm:grid-cols-2">
            <div className="cs-login-feature"><BookOpen size={19} aria-hidden="true" /><div><strong>Supervisão fluida</strong><span>Encontre rapidamente o que importa para a aula.</span></div></div>
            <div className="cs-login-feature"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Acesso protegido</strong><span>Informações disponíveis conforme seu perfil.</span></div></div>
          </div>
        </section>

        <section className="cs-login-form p-7 sm:p-12 flex flex-col justify-center" aria-label="Acessar aplicativo">
          <div className="max-w-sm mx-auto w-full">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 mb-6"><LockKeyhole size={23} aria-hidden="true" /></div>
            <p className="text-xs uppercase tracking-[0.16em] font-bold text-teal-800">Bem-vinda de volta</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-3">Acesse sua Central</h2>
            <p className="text-sm leading-relaxed text-slate-600 mt-3">
              Entre com sua conta Google autorizada. As permissões de acesso são verificadas pelo aplicativo.
            </p>
            {(errorLocal || connectionErrorMessage) && (
              <div role="alert" className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                <strong>Não foi possível conectar.</strong><p className="mt-1 break-words">{errorLocal || connectionErrorMessage}</p>
              </div>
            )}
            <button type="button" onClick={handleConectar} disabled={isCarregando}
              className="cs-login-button mt-8 w-full min-h-[54px] rounded-xl px-5 flex items-center justify-center gap-3 font-bold text-sm disabled:opacity-60 disabled:cursor-wait">
              {isCarregando ? <><RefreshCw size={18} className="animate-spin" aria-hidden="true" /> Verificando acesso…</>
                : <>Entrar com Google <ArrowRight size={18} aria-hidden="true" /></>}
            </button>
            <p className="mt-5 flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
              <CheckCircle2 size={16} className="text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
              Sua conta só terá acesso às turmas e funcionalidades autorizadas.
            </p>
            <div className="border-t border-slate-200 mt-9 pt-6 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={16} aria-hidden="true" /> Espaço acadêmico de acesso restrito
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
