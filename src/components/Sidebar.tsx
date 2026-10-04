import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Award,
  AlertCircle,
  Calendar,
  Settings,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { NavTab } from '../types';
export type { NavTab };

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const {
    periodos,
    selectedPeriodoId,
    setSelectedPeriodoId,
    orientacoes,
    documentos,
    frequencias,
    connectionStatus,
    saveStatus,
    currentUser,
    isLoggingIn,
    loginGoogle,
    logoutGoogle,
  } = useSupervisao();

  // Quick total attention count
  const openOrientacoes = orientacoes.filter(o => o.status === 'ABERTA').length;
  const pendingDocs = documentos.filter(d => d.status === 'PENDENTE').length;
  const unexcusedAbsences = frequencias.filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA').length;
  const totalAlerts = openOrientacoes + pendingDocs + unexcusedAbsences;

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);

  const navItems = [
    { id: 'hoje' as NavTab, label: 'Hoje', icon: LayoutDashboard },
    { id: 'turmas' as NavTab, label: 'Turmas', icon: Users },
    { id: 'alunos' as NavTab, label: 'Alunos', icon: GraduationCap },
    { id: 'avaliacao' as NavTab, label: 'Avaliação', icon: Award },
    { id: 'calendario' as NavTab, label: 'Calendário', icon: Calendar },
    {
      id: 'pendencias' as NavTab,
      label: 'Pendências',
      icon: AlertCircle,
      badge: totalAlerts > 0 ? totalAlerts : undefined,
    },
  ];

  const secondaryItems = [
    { id: 'semestres' as NavTab, label: 'Semestres', icon: Calendar },
    { id: 'configuracoes' as NavTab, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside
      className={`
        w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none
        ${isOpenMobile ? 'fixed inset-y-0 left-0 z-50 shadow-xl' : 'hidden md:flex'}
      `}
    >
      <div>
        {/* Brand / Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wide">
              CS
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
                Central de Supervisão
              </h1>
              <p className="text-[11px] text-slate-500">Estágios de Psicologia</p>
            </div>
          </div>

          {/* Context Selector: Período Letivo */}
          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <label className="text-[11px] font-medium text-slate-400 block mb-1">
              Período Letivo
            </label>
            <div className="relative">
              <select
                value={selectedPeriodoId}
                onChange={e => setSelectedPeriodoId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg py-2 pl-3 pr-8 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
              >
                {periodos.length === 0 ? (
                  <option value="">Aguardando base oficial...</option>
                ) : (
                  periodos.map(p => (
                    <option key={p.periodo_id} value={p.periodo_id}>
                      {p.nome} {p.status === 'ATIVO' ? '(Atual)' : `(${p.status.toLowerCase()})`}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left
                  ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`
                      text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                      ${isActive ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-amber-100 text-amber-800'}
                    `}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="px-6 py-2">
          <div className="border-t border-slate-100" />
        </div>

        {/* Secondary Navigation */}
        <nav className="p-3 space-y-1">
          {secondaryItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left
                  ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Connection Status */}
      <div className="p-3 m-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Google Sheets</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">30 tabelas</span>
        </div>

        {/* Connection status badge */}
        <div className="flex items-center gap-1.5">
          {connectionStatus === 'CONECTADO' && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-700">Sheets Conectado</span>
            </>
          )}
          {connectionStatus === 'LOCAL_DEV' && (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[11px] font-semibold text-slate-700">Modo Local / Prévia</span>
            </>
          )}
          {connectionStatus === 'CARREGANDO' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-spin" />
              <span className="text-[11px] font-semibold text-amber-700">Sincronizando...</span>
            </>
          )}
          {connectionStatus === 'ERRO_CONEXAO' && (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[11px] font-semibold text-red-700">Erro na Conexão</span>
            </>
          )}
        </div>

        {/* Google Workspace Auth Action (Preview Mode) */}
        {connectionStatus !== 'CONECTADO' && (
          <button
            onClick={loginGoogle}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 px-2 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 mt-1"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>{isLoggingIn ? 'Conectando...' : 'Conectar Planilha Oficial'}</span>
          </button>
        )}

        {currentUser && (
          <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200">
            <span className="truncate max-w-[130px]" title={currentUser.email || ''}>
              {currentUser.email}
            </span>
            <button
              onClick={logoutGoogle}
              className="text-slate-700 hover:text-red-600 font-semibold cursor-pointer underline"
            >
              Sair
            </button>
          </div>
        )}

        {/* Save status notification */}
        {saveStatus === 'SALVANDO' && (
          <div className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
            <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-amber-600 border-t-transparent rounded-full" />
            Gravando no Sheets...
          </div>
        )}
        {saveStatus === 'SALVO' && (
          <div className="text-[10px] font-semibold text-emerald-600">
            ✓ Sincronizado no Sheets
          </div>
        )}
        {saveStatus === 'ERRO_SALVAR' && (
          <div className="text-[10px] font-semibold text-red-600">
            ⚠ Falha ao salvar no Sheets
          </div>
        )}
      </div>
    </aside>
  );
};
