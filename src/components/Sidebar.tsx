import React, { useState } from 'react';
import {
  ArrowLeft, Award, Calendar, CheckCircle2, CloudOff, GraduationCap, Home, ListChecks, Menu, PenLine,
  RefreshCw, Search, Settings, TriangleAlert, Users, X, ExternalLink,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import type { NavTab } from '../types';
import { Botao } from './ui';

const ITENS: { id: NavTab; rotulo: string; icone: React.ElementType }[] = [
  { id: 'hoje', rotulo: 'Hoje', icone: Home },
  { id: 'turmas', rotulo: 'Turmas', icone: Users },
  { id: 'pendencias', rotulo: 'Pendências', icone: ListChecks },
  { id: 'alunos', rotulo: 'Estudantes', icone: GraduationCap },
  { id: 'avaliacao', rotulo: 'Avaliação', icone: Award },
  { id: 'calendario', rotulo: 'Calendário', icone: Calendar },
  { id: 'ajustes', rotulo: 'Ajustes', icone: Settings },
];

function useAbaAtual(): NavTab | null {
  const { tela } = useNavegacao();
  if (tela.tipo === 'aba') return tela.aba;
  if (tela.tipo === 'turma') return 'turmas';
  return null;
}

const ListaMenu: React.FC<{ aoEscolher?: () => void }> = ({ aoEscolher }) => {
  const { pendencias } = useSupervisao();
  const { abrirAba } = useNavegacao();
  const atual = useAbaAtual();
  return (
    <nav className="p-3 space-y-1" aria-label="Menu principal">
      {ITENS.map(({ id, rotulo, icone: Icone }) => {
        const ativo = atual === id;
        const contador = id === 'pendencias' ? pendencias.length : 0;
        return (
          <button
            key={id}
            onClick={() => { abrirAba(id); aoEscolher?.(); }}
            aria-current={ativo ? 'page' : undefined}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[15px] font-semibold cursor-pointer ${
              ativo ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-3"><Icone className="w-5 h-5" />{rotulo}</span>
            {contador > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ativo ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'}`}>
                {contador}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

const SeletorPeriodo: React.FC = () => {
  const { periodos, selectedPeriodoId, setSelectedPeriodoId } = useSupervisao();
  if (periodos.length <= 1) return null;
  return (
    <label className="block px-3">
      <span className="text-xs font-semibold text-slate-500">Semestre</span>
      <select
        value={selectedPeriodoId}
        onChange={e => setSelectedPeriodoId(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
      >
        {periodos.map(p => (
          <option key={p.periodo_id} value={p.periodo_id}>
            {p.nome}{p.status === 'ATIVO' ? ' (atual)' : p.status === 'PLANEJADO' ? ' (planejado)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
};

export const Sidebar: React.FC = () => (
  <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-white border-r border-slate-200">
    <div className="p-4 flex items-center gap-3 border-b border-slate-100">
      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">CS</div>
      <div>
        <p className="font-bold text-slate-900 leading-tight">Central de Supervisão</p>
        <p className="text-xs text-slate-500">Estágios de Psicologia</p>
      </div>
    </div>
    <div className="pt-3"><SeletorPeriodo /></div>
    <ListaMenu />
  </aside>
);

/** Um único selo diz se tudo está salvo na planilha, enviando, ou precisa de você. */
export const SeloSincronizacao: React.FC = () => {
  const { syncStatusState, precisaReconectar, loginGoogle, isLoggingIn, sincronizarAgora, spreadsheetUrl, connectionErrorMessage } = useSupervisao();
  const [aberto, setAberto] = useState(false);
  const pend = syncStatusState.pendentesCount;
  const sincronizando = syncStatusState.status === 'SINCRONIZANDO';
  const temErro = syncStatusState.status === 'ERRO' || (syncStatusState.status === 'PARCIAL' && syncStatusState.erros.length > 0);

  let estilo = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let icone = <CheckCircle2 className="w-4 h-4" />;
  let texto = 'Tudo salvo';
  if (precisaReconectar) {
    estilo = 'bg-amber-50 text-amber-900 border-amber-300';
    icone = <CloudOff className="w-4 h-4" />;
    texto = pend > 0 ? `${pend} no aparelho · Conectar` : 'Conectar Google';
  } else if (sincronizando || pend > 0) {
    estilo = 'bg-blue-50 text-blue-800 border-blue-200';
    icone = <RefreshCw className="w-4 h-4 animate-spin" />;
    texto = pend > 0 ? `Enviando ${pend}…` : 'Atualizando…';
  } else if (temErro) {
    estilo = 'bg-amber-50 text-amber-900 border-amber-300';
    icone = <TriangleAlert className="w-4 h-4" />;
    texto = 'Ver aviso';
  }

  const ultima = syncStatusState.ultimaSincronizacao
    ? new Date(syncStatusState.ultimaSincronizacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'ainda não sincronizado';

  return (
    <div className="relative">
      <button
        onClick={() => (precisaReconectar ? loginGoogle() : setAberto(a => !a))}
        disabled={isLoggingIn}
        className={`min-h-10 inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-semibold cursor-pointer ${estilo}`}
        title="Situação do salvamento na planilha"
      >
        {icone}
        <span className="hidden sm:inline">{isLoggingIn ? 'Conectando…' : texto}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-12 z-40 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900">Salvamento na planilha</p>
            <button onClick={() => setAberto(false)} aria-label="Fechar" className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-slate-700">Última leitura: <strong>{ultima}</strong></p>
          <p className="text-slate-700">
            {pend > 0 ? <>Aguardando envio: <strong>{pend}</strong> alteração(ões). Elas já estão salvas neste aparelho.</> : 'Nenhuma alteração aguardando envio.'}
          </p>
          {[...(connectionErrorMessage ? [connectionErrorMessage] : []), ...syncStatusState.erros].slice(0, 4).map((e, i) => (
            <p key={i} className="text-amber-900 bg-amber-50 rounded-lg p-2">{e}</p>
          ))}
          <div className="flex gap-2">
            <Botao variante="primario" tamanho="sm" onClick={() => { void sincronizarAgora(); setAberto(false); }} icone={<RefreshCw className="w-4 h-4" />}>
              Sincronizar agora
            </Botao>
            <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:underline px-2">
              Planilha <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export const BarraSuperior: React.FC = () => {
  const { podeVoltar, voltar, tela, abrirBusca, abrirAnotar } = useNavegacao();
  const [menuAberto, setMenuAberto] = useState(false);
  const mostrarVoltar = podeVoltar && tela.tipo !== 'aba';

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center gap-2 shrink-0">
        <button onClick={() => setMenuAberto(true)} className="lg:hidden p-2 rounded-xl hover:bg-slate-100 cursor-pointer" aria-label="Abrir menu">
          <Menu className="w-6 h-6" />
        </button>
        {mostrarVoltar && (
          <Botao variante="fantasma" tamanho="sm" onClick={voltar} icone={<ArrowLeft className="w-5 h-5" />}>
            <span className="hidden sm:inline">Voltar</span>
          </Botao>
        )}
        <div className="flex-1" />
        <Botao variante="secundario" tamanho="sm" onClick={abrirBusca} icone={<Search className="w-4 h-4" />} title="Buscar (Ctrl+K)">
          <span className="hidden sm:inline">Buscar</span>
        </Botao>
        <Botao variante="primario" tamanho="sm" onClick={() => abrirAnotar()} icone={<PenLine className="w-4 h-4" />} title="Anotar rapidamente (tecla N)">
          Anotar
        </Botao>
        <SeloSincronizacao />
      </header>

      {menuAberto && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/40" onClick={() => setMenuAberto(false)}>
          <div className="w-72 max-w-[85%] h-full bg-white shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <p className="font-bold text-slate-900">Central de Supervisão</p>
              <button onClick={() => setMenuAberto(false)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Fechar menu"><X className="w-5 h-5" /></button>
            </div>
            <div className="pt-3"><SeletorPeriodo /></div>
            <ListaMenu aoEscolher={() => setMenuAberto(false)} />
          </div>
        </div>
      )}
    </>
  );
};
