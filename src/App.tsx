import React, { useState } from 'react';
import { Menu, X, Play, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { SupervisaoProvider, useSupervisao } from './context/SupervisaoContext';
import { Sidebar } from './components/Sidebar';
import { SyncIndicator } from './components/SyncIndicator';
import { PrimeiraConexaoView } from './views/PrimeiraConexaoView';
import { NavTab } from './types';
import { DashboardView } from './views/DashboardView';
import { HojeView } from './views/HojeView';
import { AvaliacaoView } from './views/AvaliacaoView';
import { CalendarioView } from './views/CalendarioView';
import { TurmasView, TurmaDetalheView } from './views/TurmasView';
import { ModoSupervisaoView } from './views/ModoSupervisaoView';
import { AlunosListView } from './views/AlunosListView';
import { AlunoFichaView } from './views/AlunoFichaView';
import { FrequenciaView } from './views/FrequenciaView';
import { PendenciasView } from './views/PendenciasView';
import { SemestresView } from './views/SemestresView';
import { ConfiguracoesView } from './views/ConfiguracoesView';

type AppView =
  | { type: 'tab'; tab: NavTab; filterParam?: string }
  | { type: 'turma-detalhe'; turmaId: string }
  | { type: 'modo-supervisao'; turmaId: string }
  | { type: 'aluno-ficha'; matriculaId: string; initialTab?: string; returnTo?: 'supervisao' | 'turma' | 'alunos' | 'dashboard' | 'pendencias'; returnTurmaId?: string };

const MainContent: React.FC = () => {
  const {
    periodos,
    hasLocalCache,
    connectionStatus,
    syncStatusState,
    sincronizarAgora,
  } = useSupervisao();

  const [currentView, setCurrentView] = useState<AppView>({ type: 'tab', tab: 'hoje' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Navigation handlers
  const handleSelectNavTab = (tab: NavTab) => {
    setCurrentView({ type: 'tab', tab });
  };

  const handleOpenTurma = (turmaId: string) => {
    setCurrentView({ type: 'turma-detalhe', turmaId });
  };

  const handleIniciarSupervisao = (turmaId: string) => {
    setCurrentView({ type: 'modo-supervisao', turmaId });
  };

  const handleOpenAlunoFicha = (
    matriculaId: string,
    initialTab: string = 'resumo',
    fromWhere?: 'supervisao' | 'turma' | 'alunos' | 'dashboard' | 'pendencias',
    fromTurmaId?: string
  ) => {
    let returnTo = fromWhere;
    let returnTurmaId = fromTurmaId;

    if (!returnTo) {
      if (currentView.type === 'modo-supervisao') {
        returnTo = 'supervisao';
        returnTurmaId = currentView.turmaId;
      } else if (currentView.type === 'turma-detalhe') {
        returnTo = 'turma';
        returnTurmaId = currentView.turmaId;
      } else if (currentView.type === 'tab' && currentView.tab === 'pendencias') {
        returnTo = 'pendencias';
      } else if (currentView.type === 'tab' && currentView.tab === 'dashboard') {
        returnTo = 'dashboard';
      } else {
        returnTo = 'alunos';
      }
    }

    setCurrentView({
      type: 'aluno-ficha',
      matriculaId,
      initialTab,
      returnTo,
      returnTurmaId,
    });
  };

  const handleVoltarDeAluno = () => {
    if (currentView.type === 'aluno-ficha') {
      if (currentView.returnTo === 'supervisao' && currentView.returnTurmaId) {
        setCurrentView({ type: 'modo-supervisao', turmaId: currentView.returnTurmaId });
      } else if (currentView.returnTo === 'turma' && currentView.returnTurmaId) {
        setCurrentView({ type: 'turma-detalhe', turmaId: currentView.returnTurmaId });
      } else if (currentView.returnTo === 'pendencias') {
        setCurrentView({ type: 'tab', tab: 'pendencias' });
      } else if (currentView.returnTo === 'dashboard') {
        setCurrentView({ type: 'tab', tab: 'dashboard' });
      } else {
        setCurrentView({ type: 'tab', tab: 'alunos' });
      }
    } else {
      setCurrentView({ type: 'tab', tab: 'dashboard' });
    }
  };

  // 1. Estado de carregamento inicial
  if (connectionStatus === 'CARREGANDO' && !hasLocalCache && periodos.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-4" />
        <h2 className="text-lg font-bold tracking-tight">Central de Supervisão Acadêmica</h2>
        <p className="text-xs text-slate-400 mt-1">Carregando cache persistente e verificando base oficial...</p>
      </div>
    );
  }

  // 2. Primeira Conexão: quando ainda não há dados em cache no IndexedDB
  if (!hasLocalCache && periodos.length === 0) {
    return <PrimeiraConexaoView />;
  }

  // If in Modo Supervisão, we hide the main sidebar to maximize screen space for the tablet landscape split-screen!
  const isModoSupervisao = currentView.type === 'modo-supervisao';

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar (hidden during Modo Supervisão for maximum tablet focus) */}
      {!isModoSupervisao && (
        <Sidebar
          currentTab={currentView.type === 'tab' ? currentView.tab : 'dashboard'}
          onSelectTab={handleSelectNavTab}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Persistent Global Header Bar */}
        {!isModoSupervisao && (
          <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="md:hidden flex items-center gap-2">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-700"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <span className="font-bold text-sm text-slate-900">Central de Supervisão</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Central de Supervisão</span>
                <span>•</span>
                <span>Base Oficial Google Sheets</span>
              </div>
            </div>

            {/* Persistent Global Sync Indicator & Details */}
            <div className="flex items-center gap-3">
              <SyncIndicator />
            </div>
          </header>
        )}

        {/* Offline / Cache Fallback Notice Banner */}
        {syncStatusState.status === 'LOCAL' && syncStatusState.erros.length > 0 && hasLocalCache && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Não foi possível atualizar a base oficial. Exibindo dados da última sincronização de{' '}
                <strong>
                  {syncStatusState.ultimaSincronizacao
                    ? new Date(syncStatusState.ultimaSincronizacao).toLocaleString('pt-BR')
                    : 'data recente'}
                </strong>.
              </span>
            </div>
            <button
              onClick={() => sincronizarAgora()}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold cursor-pointer shrink-0 ml-2"
            >
              Sincronizar
            </button>
          </div>
        )}

        {/* Viewport View Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentView.type === 'tab' && currentView.tab === 'hoje' && (
            <HojeView
              onOpenTurma={handleOpenTurma}
              onIniciarSupervisao={handleIniciarSupervisao}
              onNavigateToTab={(tab, param) => setCurrentView({ type: 'tab', tab, filterParam: param })}
            />
          )}

          {currentView.type === 'tab' && currentView.tab === 'dashboard' && (
            <DashboardView
              onOpenTurma={handleOpenTurma}
              onIniciarSupervisao={handleIniciarSupervisao}
              onNavigateToTab={(tab, param) => setCurrentView({ type: 'tab', tab, filterParam: param })}
            />
          )}

          {currentView.type === 'tab' && currentView.tab === 'avaliacao' && (
            <AvaliacaoView />
          )}

          {currentView.type === 'tab' && currentView.tab === 'calendario' && (
            <CalendarioView />
          )}

          {currentView.type === 'tab' && currentView.tab === 'turmas' && (
            <TurmasView
              onSelectTurma={handleOpenTurma}
              onIniciarSupervisao={handleIniciarSupervisao}
              onOpenAluno={matId => handleOpenAlunoFicha(matId, 'resumo', 'turma')}
            />
          )}

          {currentView.type === 'tab' && currentView.tab === 'alunos' && (
            <AlunosListView
              onOpenAluno={matId => handleOpenAlunoFicha(matId, 'resumo', 'alunos')}
            />
          )}

          {currentView.type === 'tab' && currentView.tab === 'frequencia' && (
            <FrequenciaView
              onOpenAluno={(matId, tab) => handleOpenAlunoFicha(matId, tab || 'frequencia', 'alunos')}
            />
          )}

          {currentView.type === 'tab' && currentView.tab === 'pendencias' && (
            <PendenciasView
              initialFilterType={currentView.filterParam}
              onOpenAluno={(matId, tab) => handleOpenAlunoFicha(matId, tab || 'resumo', 'pendencias')}
            />
          )}

          {currentView.type === 'tab' && currentView.tab === 'semestres' && <SemestresView />}

          {currentView.type === 'tab' && currentView.tab === 'configuracoes' && (
            <ConfiguracoesView />
          )}

          {currentView.type === 'turma-detalhe' && (
            <TurmaDetalheView
              turmaId={currentView.turmaId}
              onVoltar={() => setCurrentView({ type: 'tab', tab: 'turmas' })}
              onIniciarSupervisao={handleIniciarSupervisao}
              onOpenAluno={matId =>
                handleOpenAlunoFicha(matId, 'resumo', 'turma', currentView.turmaId)
              }
            />
          )}

          {currentView.type === 'modo-supervisao' && (
            <ModoSupervisaoView
              turmaId={currentView.turmaId}
              onEncerrar={() => setCurrentView({ type: 'turma-detalhe', turmaId: currentView.turmaId })}
              onOpenFichaAluno={(matId, tab) =>
                handleOpenAlunoFicha(matId, tab || 'resumo', 'supervisao', currentView.turmaId)
              }
            />
          )}

          {currentView.type === 'aluno-ficha' && (
            <AlunoFichaView
              matriculaId={currentView.matriculaId}
              initialTab={currentView.initialTab}
              onVoltar={handleVoltarDeAluno}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <SupervisaoProvider>
      <MainContent />
    </SupervisaoProvider>
  );
}
