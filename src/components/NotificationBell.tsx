import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import type { NavTab, NotificacaoDerivada } from '../types';

interface NotificationBellProps {
  onNavigate: (tab: NavTab, param?: string) => void;
  onOpenSupervisao?: (turmaId: string) => void;
}
type Grupo = { key: string; titulo: string; tipo: string; turma: string; itens: NotificacaoDerivada[]; assinatura: string };
const storageKey = (uid: string) => 'cs_notificacoes_lidas_v1:' + uid;
/** Não armazenar nomes, descrições, matrículas ou identificadores brutos no navegador só para marcar leitura. */
function assinaturaCurta(mensagens: string[]): string {
  let hash = 2166136261;
  for (const caractere of mensagens.sort().join('|')) hash = Math.imul(hash ^ caractere.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
function carregarLidas(uid: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(storageKey(uid)) || '{}'); } catch { return {}; }
}
function salvarLidas(uid: string, lidas: Record<string, string>) {
  try { localStorage.setItem(storageKey(uid), JSON.stringify(lidas)); } catch {}
}

/** Resumos por turma e tópico, sem alerta pulsante e sem tratar "lida" como pendência resolvida. */
export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { currentUser, getNotificacoesDerivadas, getPendenciasCanonicas } = useSupervisao();
  const uid = currentUser?.uid || '';
  const [aberto, setAberto] = useState(false);
  const [mostrarLidas, setMostrarLidas] = useState(false);
  const [lidas, setLidas] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setLidas(uid ? carregarLidas(uid) : {}); setAberto(false); }, [uid]);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  const canonicas = getPendenciasCanonicas();
  const acao: NotificacaoDerivada[] = canonicas.map(p => ({
    id: p.id, titulo: p.titulo, mensagem: p.descricao, categoria: 'REQUER_ACAO',
    tipo: (p.tipo === 'CHAMADA' ? 'CHAMADA_PENDENTE'
      : p.tipo === 'JUSTIFICATIVA' || p.tipo === 'FALTA_INJUSTIFICADA' ? 'JUSTIFICATIVA_PENDENTE'
      : p.tipo === 'ESTUDO_DIRIGIDO' ? 'ESTUDO_DIRIGIDO_PENDENTE'
      : p.tipo === 'PRAZO' ? 'PRAZO_VENCIDO' : 'DOCUMENTO_PENDENTE') as NotificacaoDerivada['tipo'],
    turma_id: p.turma_id, turma_nome: p.turma_nome, matricula_id: p.matricula_id,
    targetTab: 'pendencias', targetParam: p.turma_id,
  }));
  const informativas = getNotificacoesDerivadas().filter(n => n.categoria === 'INFORMATIVO');
  const grupos = useMemo(() => {
    const mapa = new Map<string, Grupo>();
    for (const n of [...acao, ...informativas]) {
      const key = (n.turma_id || 'geral') + '::' + n.tipo;
      if (!mapa.has(key)) mapa.set(key, {
        key, titulo: n.tipo.replaceAll('_', ' ').toLowerCase(), tipo: n.tipo,
        turma: n.turma_nome || 'Geral', itens: [], assinatura: '',
      });
      mapa.get(key)!.itens.push(n);
    }
    return [...mapa.values()].map(g => ({
      ...g, assinatura: assinaturaCurta(g.itens.map(n => n.id + ':' + n.mensagem)),
    })).sort((a, b) => {
      const prioridade = (g: Grupo) => g.itens.some(n => n.categoria === 'REQUER_ACAO') ? 0 : 1;
      return prioridade(a) - prioridade(b) || a.turma.localeCompare(b.turma) || a.tipo.localeCompare(b.tipo);
    });
  }, [acao.map(n => n.id + ':' + n.mensagem).join('|'), informativas.map(n => n.id + ':' + n.mensagem).join('|')]);
  const novas = grupos.filter(g => lidas[g.key] !== g.assinatura);
  const visiveis = mostrarLidas ? grupos : novas;
  const marcar = (gs: Grupo[]) => {
    if (!uid) return;
    const proximo = { ...lidas };
    for (const g of gs) proximo[g.key] = g.assinatura;
    setLidas(proximo);
    salvarLidas(uid, proximo);
  };
  const navegar = (g: Grupo) => {
    marcar([g]);
    setAberto(false);
    const primeira = g.itens[0];
    if (primeira?.targetTab) onNavigate(primeira.targetTab, primeira.targetParam);
    else onNavigate('pendencias', primeira?.turma_id);
  };

  return <div className="relative" ref={ref}>
    <button type="button" onClick={() => setAberto(v => !v)}
      title="Notificações agrupadas" aria-label={'Notificações: ' + novas.length + ' grupos novos'}
      className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600">
      <Bell className="w-4 h-4" />
      {novas.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {novas.length > 99 ? '99+' : novas.length}
      </span>}
    </button>
    {aberto && <div className="absolute right-0 mt-2 w-[min(92vw,25rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs">
      <div className="bg-slate-900 text-white p-3 flex items-center justify-between gap-2">
        <div><strong className="text-sm">Notificações</strong><p className="text-[11px] text-slate-300">{novas.length} tópico(s) novo(s) · {grupos.length} grupo(s) no total</p></div>
        <button onClick={() => setAberto(false)} className="p-2 hover:bg-slate-800 rounded" aria-label="Fechar notificações"><X size={16}/></button>
      </div>
      <div className="p-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
        <label className="flex gap-2 items-center text-slate-700"><input type="checkbox" checked={mostrarLidas} onChange={e => setMostrarLidas(e.target.checked)}/> Mostrar lidas</label>
        <button disabled={novas.length === 0} onClick={() => marcar(novas)}
          className="text-teal-800 font-semibold disabled:opacity-40 flex gap-1 items-center min-h-9"><CheckCheck size={15}/> Marcar todas como lidas</button>
      </div>
      <div className="max-h-[min(65dvh,30rem)] overflow-y-auto divide-y divide-slate-100">
        {visiveis.length === 0 ? <p className="text-center text-slate-600 p-7">Nenhuma notificação nova. As pendências acadêmicas continuam disponíveis na página Pendências.</p> :
          visiveis.map(g => <button type="button" key={g.key} onClick={() => navegar(g)}
            className="block w-full text-left p-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0"><p className="font-bold text-slate-900">{g.turma} · {g.titulo}</p>
                <p className="text-slate-700 mt-1">{g.itens.length} ocorrência(s) neste tópico</p>
                <p className="text-slate-500 mt-1 line-clamp-2">{g.itens.slice(0, 2).map(n => n.mensagem).join(' · ')}</p>
                {g.itens.length > 2 && <span className="text-slate-500">e mais {g.itens.length - 2} ocorrência(s)</span>}
              </div><ChevronRight size={16} className="shrink-0 text-slate-400"/>
            </div>
          </button>)}
      </div>
      <p className="px-3 py-2 border-t text-[11px] text-slate-600">Marcar como lida não resolve, modifica ou exclui pendências acadêmicas.</p>
    </div>}
  </div>;
};
