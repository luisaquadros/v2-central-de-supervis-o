import React, { useState } from 'react';
import { Menu, X, Play, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { SupervisaoProvider, useSupervisao } from './context/SupervisaoContext';
import { Sidebar } from './components/Sidebar';
import { SyncIndicator } from './components/SyncIndicator';
import { NotificationBell } from './components/NotificationBell';
import { ThemeControl } from './components/ThemeControl';
import { AppErrorMonitor } from './components/AppErrorMonitor';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PrepararAulaModal } from './components/PrepararAulaModal';
import { ErrorNotifier } from './components/ErrorNotifier';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';
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
  | { type: 'modo-supervisao'; turmaId: string; dataAula?: string }
  | { type: 'aluno-ficha'; matriculaId: string; initialTab?: string; returnTo?: 'supervisao' | 'turma' | 'alunos' | 'dashboard' | 'pendencias'; returnTurmaId?: string };

const MainContent: React.FC = () => {
  const {
    periodos,
    turmas,
    selectedPeriodoId,
    getSupervisaoAtual,
    getProximaSupervisao,
    currentUser,
    acessoGoogleValidado,
    hasLocalCache,
    connectionStatus,
    syncStatusState,
    sincronizarAgora,
    perfilServidor,
  } = useSupervisao();
  const podeAvaliar = perfilServidor?.papel === 'PROFESSORA_ADMIN';

  const [currentView, setCurrentView] = useState<AppView>({ type: 'tab', tab: 'hoje' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [prepararTurmaId, setPrepararTurmaId] = useState<string | null>(null);
  const ultimaConta = React.useRef<string | null>(null);
  React.useEffect(() => {
    const uid = currentUser?.uid ?? null;
    if (ultimaConta.current === uid) return;
    ultimaConta.current = uid;
    setCurrentView({ type: 'tab', tab: 'hoje' });
    setIsMobileMenuOpen(false);
    setPrepararTurmaId(null);
  }, [currentUser?.uid]);
  // Evita tela vazia quando a mesma sessão assume um perfil mais restrito.
  React.useEffect(() => {
    if (podeAvaliar) return;
    setCurrentView(v => v.type === 'tab' && ['avaliacao', 'semestres', 'configuracoes'].includes(v.tab)
      ? { type: 'tab', tab: 'hoje' } : v);
  }, [podeAvaliar]);

  // Navigation handlers
  const handleSelectNavTab = (tab: NavTab) => {
    setCurrentView({ type: 'tab', tab });
  };

  const handleMobileSelect = (action: 'hoje'|'turmas'|'aula'|'avaliacao'|'menu') => {
    if (action === 'menu') { setIsMobileMenuOpen(true); return; }
    if (action === 'avaliacao' && !podeAvaliar) return;
    setIsMobileMenuOpen(false);
    if (action === 'aula') {
      const turma = getSupervisaoAtual().turma || getProximaSupervisao()?.turma ||
        turmas.find(t => t.periodo_id === selectedPeriodoId && t.status === 'ATIVO') ||
        turmas.find(t => t.status === 'ATIVO');
      setCurrentView(turma ? {type:'modo-supervisao',turmaId:turma.turma_id} : {type:'tab',tab:'turmas'});
      return;
    }
    setCurrentView({type:'tab',tab: action === 'avaliacao' ? 'avaliacao' : action});
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

  // 2. Proteção de dados acadêmicos: cache de dispositivo nunca libera telas sem login.
  // Firebase preserva o login legítimo ao atualizar a página; Sheets mantém permissão por conta.
  if ((!currentUser || !acessoGoogleValidado) || (!hasLocalCache && periodos.length === 0)) {
    return <PrimeiraConexaoView />;
  }

  // If in Modo Supervisão, we hide the main sidebar to maximize screen space for the tablet landscape split-screen!
  const isModoSupervisao = currentView.type === 'modo-supervisao';

  return (
    <div className="flex h-[100dvh] min-h-0 cs-muted-surface overflow-hidden font-sans">
      <ErrorNotifier />
      {isMobileMenuOpen && !isModoSupervisao && (
        <button type="button" aria-label="Fechar menu de navegação"
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
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
          <header className="bg-white border-b border-slate-200 px-2.5 sm:px-4 py-2.5 flex items-center justify-between shrink-0 shadow-2xs min-w-0 gap-1">
            <div className="flex items-center gap-3">
              <div className="md:hidden flex items-center gap-2">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                  aria-expanded={isMobileMenuOpen}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-700"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <span className="font-bold text-xs text-slate-900 sm:text-sm truncate hidden min-[375px]:inline">Supervisão</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Central de Supervisão</span>
                <span>•</span>
                <span>Base acadêmica conectada</span>
              </div>
            </div>

            {/* Persistent Global Sync Indicator, Notifications & Details */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="hidden sm:block"><ThemeControl /></div>
              <AppErrorMonitor />
              <NotificationBell
                onNavigate={(tab, param) => setCurrentView({ type: 'tab', tab, filterParam: param })}
                onOpenSupervisao={turmaId => setCurrentView({ type: 'modo-supervisao', turmaId })}
              />
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

        {/* Viewport View Content with Resilience against White Screen */}
        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-6 lg:p-8 ${isModoSupervisao ? '' : 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8'}`}>
          <ViewErrorBoundary
            key={
              currentView.type === 'tab'
                ? `tab-${currentView.tab}`
                : currentView.type === 'turma-detalhe'
                ? `turma-${currentView.turmaId}`
                : currentView.type === 'modo-supervisao'
                ? `supervisao-${currentView.turmaId}`
                : `aluno-${currentView.matriculaId}`
            }
            viewName={
              currentView.type === 'tab'
                ? `da aba "${currentView.tab}"`
                : currentView.type === 'turma-detalhe'
                ? 'dos detalhes da turma'
                : currentView.type === 'modo-supervisao'
                ? 'do modo supervisão'
                : 'da ficha do estudante'
            }
          >
            {currentView.type === 'tab' && currentView.tab === 'hoje' && (
              <HojeView
                onOpenTurma={handleOpenTurma}
                onIniciarSupervisao={handleIniciarSupervisao}
                onOpenPrepararAula={setPrepararTurmaId}
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

            {currentView.type === 'tab' && currentView.tab === 'avaliacao' && podeAvaliar && (
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
                onOpenSupervisao={(turmaId, dataAula) => setCurrentView({ type: 'modo-supervisao', turmaId, dataAula })}
                initialSubTab={(currentView.filterParam as any) || 'grade'}
              />
            )}

            {currentView.type === 'tab' && currentView.tab === 'pendencias' && (
              <PendenciasView
                initialFilterType={currentView.filterParam}
                onOpenAluno={(matId, tab) => handleOpenAlunoFicha(matId, tab || 'resumo', 'pendencias')}
              />
            )}

            {currentView.type === 'tab' && currentView.tab === 'semestres' && podeAvaliar && <SemestresView />}

            {currentView.type === 'tab' && currentView.tab === 'configuracoes' && podeAvaliar && (
              <ConfiguracoesView />
            )}

            {currentView.type === 'turma-detalhe' && (
              <TurmaDetalheView
                turmaId={currentView.turmaId}
                onVoltar={() => setCurrentView({ type: 'tab', tab: 'turmas' })}
                onIniciarSupervisao={handleIniciarSupervisao}
                onOpenPrepararAula={setPrepararTurmaId}
                onOpenAluno={matId =>
                  handleOpenAlunoFicha(matId, 'resumo', 'turma', currentView.turmaId)
                }
              />
            )}

            {currentView.type === 'modo-supervisao' && (
              <ModoSupervisaoView
                turmaId={currentView.turmaId}
                dataAulaInicial={currentView.dataAula}
                onPrepararAula={setPrepararTurmaId}
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
          </ViewErrorBoundary>
        </div>
      </main>
      {!isModoSupervisao && (
        <MobileBottomNav
          selected={currentView.type === 'tab' && ['hoje','turmas','avaliacao'].includes(currentView.tab) ?
            currentView.tab as 'hoje'|'turmas'|'avaliacao' : 'menu'}
          onSelect={handleMobileSelect}
          podeAvaliar={podeAvaliar}
        />
      )}
      {prepararTurmaId && turmas.some(t => t.turma_id === prepararTurmaId) && (
        <PrepararAulaModal
          isOpen
          onClose={() => setPrepararTurmaId(null)}
          turma={turmas.find(t => t.turma_id === prepararTurmaId)!}
          onIniciarModoAula={handleIniciarSupervisao}
        />
      )}
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
