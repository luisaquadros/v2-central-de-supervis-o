import React, { useRef, useState } from 'react';
import { Download, FileSearch, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import type { DiferencaRegistro, RelatorioBackup } from '../services/backupService';

/** Backup com checksum, conferência do arquivo e restauração registro a registro (nunca em massa). */
export const BackupPainel: React.FC = () => {
  const { exportDatabaseAsJson, conferirBackup, restaurarRegistroDoBackup, sincronizarAgora } = useSupervisao();
  const entrada = useRef<HTMLInputElement>(null);
  const [relatorio, setRelatorio] = useState<RelatorioBackup | null>(null);
  const [diferencas, setDiferencas] = useState<DiferencaRegistro[]>([]);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const baixar = async () => {
    const blob = new Blob([await exportDatabaseAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `central_supervisao_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const abrir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setMsg(''); setRelatorio(null); setDiferencas([]);
    try {
      const { relatorio: r, diferencas: d } = await conferirBackup(JSON.parse(await arquivo.text()));
      setRelatorio(r); setDiferencas(d);
    } catch { setRelatorio({ ok: false, erros: ['Não foi possível ler o arquivo (JSON inválido).'], avisos: [], contagens: {} }); }
  };
  const restaurar = async (d: DiferencaRegistro) => {
    const chave = `${d.tabela}|${d.id}`;
    setOcupado(chave); setMsg('');
    try {
      await restaurarRegistroDoBackup(d);
      setDiferencas(lista => lista.filter(x => `${x.tabela}|${x.id}` !== chave));
      setMsg('Restauração registrada. Confira o indicador de sincronização para confirmar o envio à planilha.');
      void sincronizarAgora();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível restaurar.'); }
    finally { setOcupado(null); setConfirmar(null); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3" data-testid="backup-painel">
      <h3 className="text-sm font-bold text-slate-900">Backup e restauração</h3>
      <p className="text-slate-600">O arquivo leva contagens e um checksum. Conferir um backup <b>não altera nada</b>; restaurar é sempre um registro por vez, com confirmação, e nunca apaga o que foi criado depois.</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={baixar} className="min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-900 text-white font-semibold flex items-center gap-2">
          <Download className="w-4 h-4" /> Baixar backup
        </button>
        <button onClick={() => entrada.current?.click()} className="min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 font-semibold flex items-center gap-2">
          <FileSearch className="w-4 h-4" /> Conferir um backup
        </button>
        <input ref={entrada} type="file" accept="application/json,.json" className="hidden" onChange={e => { void abrir(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {relatorio && (
        <div className={`rounded-lg border p-3 ${relatorio.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 font-semibold">
            {relatorio.ok ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <TriangleAlert className="w-4 h-4 text-red-600" />}
            {relatorio.ok ? 'Arquivo íntegro.' : 'Arquivo com problemas: não use para restaurar.'}
          </div>
          {[...relatorio.erros, ...relatorio.avisos].map((t, i) => <p key={i} className="text-xs mt-1">• {t}</p>)}
          {relatorio.ok && <p className="text-xs mt-1">{diferencas.length === 0 ? 'Nada difere do que está na planilha agora.' : `${diferencas.length} registro(s) diferem do backup.`}</p>}
        </div>
      )}
      {diferencas.length > 0 && (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
          {diferencas.map(d => {
            const chave = `${d.tabela}|${d.id}`;
            return (
              <li key={chave} className="p-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold">{d.tabela}</span>
                <span className="text-slate-500">{d.tipo === 'AUSENTE_NO_ATUAL' ? 'não existe mais na planilha' : `campos diferentes: ${d.campos.join(', ')}`}</span>
                {confirmar === chave ? (
                  <span className="ml-auto flex gap-2">
                    <button disabled={ocupado === chave} onClick={() => void restaurar(d)} className="min-h-[36px] px-3 rounded-lg bg-slate-900 text-white font-semibold">Confirmar</button>
                    <button onClick={() => setConfirmar(null)} className="min-h-[36px] px-3 rounded-lg border border-slate-300">Cancelar</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmar(chave)} className="ml-auto min-h-[36px] px-3 rounded-lg border border-slate-300 font-semibold flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar este registro
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p role="status" className="text-xs text-slate-700">{msg}</p>}
    </div>
  );
};
