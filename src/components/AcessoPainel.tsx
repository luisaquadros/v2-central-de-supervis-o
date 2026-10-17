import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { verificarAcessoEscrita, type EstadoAcesso } from '../services/escritaCoordenadaService';

/** Mostra se o SERVIDOR autoriza esta conta a gravar. Enquanto não houver lista configurada, ninguém grava. */
export const AcessoPainel: React.FC = () => {
  const [acesso, setAcesso] = useState<EstadoAcesso | null>(null);
  useEffect(() => { void verificarAcessoEscrita().then(setAcesso); }, []);
  const ok = acesso?.estado === 'AUTORIZADO';
  return (
    <div data-testid="acesso-painel" className={`rounded-xl border p-4 text-xs flex items-start gap-3 ${!acesso ? 'border-slate-200 bg-white' : ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-300 bg-amber-50'}`}>
      {!acesso ? <Lock className="w-4 h-4 text-slate-400 mt-0.5" /> : ok ? <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5" /> : <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5" />}
      <div>
        <div className="font-bold text-slate-900">Acesso de gravação</div>
        {!acesso && <p className="text-slate-500">Verificando no servidor…</p>}
        {acesso && ok && (() => { const a = acesso as Extract<EstadoAcesso, { estado: 'AUTORIZADO' }>; return (
          <div className="text-emerald-900 space-y-1">
            <p>{a.perfil.papel === 'PROFESSORA_ADMIN' ? 'Professora administradora' : 'Monitora'}: {a.email}. Alterações são gravadas com a sua identidade verificada pelo servidor.</p>
            {a.perfil.papel === 'MONITORA' && <p>Turmas delegadas: {a.perfil.turmas.join(', ')} · Operações: {a.perfil.operacoes.join(', ')}. Notas, ocorrências e devolutivas não ficam disponíveis a este perfil.</p>}
            {a.perfil.avisos.length > 0 && <p className="text-amber-800">Avisos de configuração: {a.perfil.avisos.join('; ')}.</p>}
          </div>); })()}
        {acesso && !ok && <p className="text-amber-900">{(acesso as { mensagem: string }).mensagem} As alterações ficam pendentes neste aparelho e não são dadas como salvas.</p>}
      </div>
    </div>
  );
};
