import React, { useState } from 'react';
import { useSupervisao } from '../context/SupervisaoContext';
import { chamarEstruturaAvaliacao } from '../services/escritaCoordenadaService';
import type { DiagnosticoAba } from '../services/estruturaAvaliacao';

const ROTULO: Record<string, string> = {
  config_avaliacao: 'Configuração por turma e período', rubricas_avaliacao: 'Rubricas (versões)',
  avaliacao_rascunhos: 'Rascunhos de avaliação', evidencias_avaliacao: 'Evidências', rss_ajustes: 'Correções e observações de RSS',
};
const SITUACAO: Record<DiagnosticoAba['situacao'], string> = { ausente: 'Ainda não criada', ok: 'Pronta', colunas_faltando: 'Cabeçalho divergente (nada será alterado)' };

/** Cria SOMENTE as cinco abas novas da avaliação e correções de RSS. Abas existentes nunca são tocadas. Exige backup e confirmação. */
export const EstruturaAvaliacaoPainel: React.FC = () => {
  const { exportDatabaseAsJson } = useSupervisao();
  const [abas, setAbas] = useState<DiagnosticoAba[] | null>(null);
  const [checksum, setChecksum] = useState('');
  const [aceite, setAceite] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const verificar = async (preservarMensagem = false) => {
    if (!preservarMensagem) setMsg('');
    setOcupado(true);
    try {
      const r = await chamarEstruturaAvaliacao('GET');
      if (r.status !== 200 || !r.corpo?.ok) throw new Error(r.corpo?.message || `Não foi possível verificar (${r.status}).`);
      setAbas(r.corpo.abas);
    } catch (e) { const erro = e instanceof Error ? e.message : 'Falha ao verificar.'; setMsg(anterior => preservarMensagem ? `${anterior} Não foi possível atualizar a situação: ${erro}` : erro); } finally { setOcupado(false); }
  };
  const gerarBackup = async () => {
    setMsg(''); setOcupado(true);
    try {
      const json = await exportDatabaseAsJson();
      const sum = String(JSON.parse(json).checksum ?? '');
      if (!/^[a-f0-9]{16,128}$/.test(sum)) throw new Error('O backup não trouxe checksum válido.');
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `backup_antes_da_estrutura_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
      setChecksum(sum);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha ao gerar o backup.'); } finally { setOcupado(false); }
  };
  const criar = async () => {
    setMsg(''); setOcupado(true);
    try {
      const r = await chamarEstruturaAvaliacao('POST', { confirmo: 'CRIAR_ESTRUTURA_AVALIACAO', backup_checksum: checksum });
      if (r.status !== 200 || !r.corpo?.ok) throw new Error(r.corpo?.message || `Não foi possível criar (${r.status}).`);
      setMsg(`Criadas: ${r.corpo.criadas.length}. Já existiam: ${r.corpo.existentes.length}. Divergentes (não alteradas): ${r.corpo.divergentes.length}.`);
      await verificar(true);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha ao criar.'); } finally { setOcupado(false); }
  };
  const faltam = abas?.some(a => a.situacao === 'ausente');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3" data-testid="estrutura-avaliacao">
      <h3 className="text-sm font-bold text-slate-900">Estrutura da avaliação e correções de RSS</h3>
      <p className="text-slate-600">Cinco abas novas, aditivas e versionadas (rubricas, evidências, rascunhos, configuração e correções de RSS). As abas atuais de critérios, notas, RSS e devolutivas <b>não são alteradas</b>. Faça primeiro em uma cópia da planilha.</p>
      <button onClick={() => void verificar()} disabled={ocupado} className="min-h-[44px]! px-4 rounded-lg border border-slate-300 font-semibold">Verificar situação</button>
      {abas && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {abas.map(a => <li key={a.aba} className="flex flex-wrap items-center justify-between gap-2 p-3"><span>{ROTULO[a.aba] ?? a.aba}</span><span className="text-xs text-slate-600">{SITUACAO[a.situacao]}</span></li>)}
        </ul>
      )}
      {abas && faltam && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="font-semibold text-slate-800">Para criar as abas que faltam</p>
          <button onClick={gerarBackup} disabled={ocupado} className="min-h-[44px]! px-4 rounded-lg bg-slate-900 text-white font-semibold">1. Baixar backup verificado</button>
          {checksum && <p className="text-xs text-emerald-700">Backup gerado (checksum {checksum.slice(0, 12)}…).</p>}
          <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 h-5 w-5" />Entendo que serão criadas somente as abas ausentes, sem alterar nenhuma aba existente.</label>
          <button onClick={criar} disabled={ocupado || !checksum || !aceite} className="min-h-[44px]! px-4 rounded-lg bg-indigo-700 text-white font-semibold disabled:opacity-40">2. Criar abas ausentes</button>
          <p className="text-xs text-slate-500">Se o botão responder que está desligado, a criação não foi habilitada neste ambiente (variável ESTRUTURA_AVALIACAO).</p>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-slate-700">{msg}</p>}
    </div>
  );
};
