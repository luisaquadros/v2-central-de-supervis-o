import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { SupervisaoProvider, useSupervisao } from './context/SupervisaoContext';
import { NavegacaoProvider, useNavegacao } from './context/NavegacaoContext';
import { Sidebar, BarraSuperior } from './components/Sidebar';
import { AvisosGlobais } from './components/AvisosGlobais';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';
import { AnotarRapidoModal } from './components/AnotarRapidoModal';
import { BuscaGlobalModal } from './components/BuscaGlobalModal';
import { PrepararAulaModal } from './components/PrepararAulaModal';
import { PrimeiraConexaoView } from './views/PrimeiraConexaoView';
import { HojeView } from './views/HojeView';
import { PendenciasView } from './views/PendenciasView';
import { TurmasView } from './views/TurmasView';
import { TurmaView } from './views/TurmaView';
import { AlunosListView } from './views/AlunosListView';
import { AlunoFichaView } from './views/AlunoFichaView';
import { AvaliacaoView } from './views/AvaliacaoView';
import { CalendarioView } from './views/CalendarioView';
import { AjustesView } from './views/AjustesView';
import { ModoSupervisaoView } from './views/ModoSupervisaoView';

const Carregando: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3 text-slate-700">
    <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
    <p className="font-semibold">{texto}</p>
  </div>
);

const Conteudo: React.FC = () => {
  const { tela } = useNavegacao();
  const chave = tela.tipo === 'aba' ? tela.aba : tela.tipo === 'turma' ? `turma-${tela.turmaId}`
    : tela.tipo === 'aula' ? `aula-${tela.turmaId}-${tela.data}` : `aluno-${tela.matriculaId}`;

  return (
    <ViewErrorBoundary key={chave} viewName={chave}>
      {tela.tipo === 'aba' && tela.aba === 'hoje' && <HojeView />}
      {tela.tipo === 'aba' && tela.aba === 'pendencias' && <PendenciasView />}
      {tela.tipo === 'aba' && tela.aba === 'turmas' && <TurmasView />}
      {tela.tipo === 'aba' && tela.aba === 'alunos' && <AlunosListView />}
      {tela.tipo === 'aba' && tela.aba === 'avaliacao' && <AvaliacaoView />}
      {tela.tipo === 'aba' && tela.aba === 'calendario' && <CalendarioView />}
      {tela.tipo === 'aba' && tela.aba === 'ajustes' && <AjustesView />}
      {tela.tipo === 'turma' && <TurmaView turmaId={tela.turmaId} abaInicial={tela.aba} />}
      {tela.tipo === 'aluno' && <AlunoFichaView matriculaId={tela.matriculaId} initialTab={tela.aba} />}
    </ViewErrorBoundary>
  );
};

const Janelas: React.FC = () => {
  const { janelas, abrirBusca, abrirAnotar } = useNavegacao();

  // Atalhos: Ctrl/Cmd+K busca; "N" anota (fora de campos de texto).
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = alvo?.tagName === 'INPUT' || alvo?.tagName === 'TEXTAREA' || alvo?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrirBusca();
      } else if (!digitando && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        abrirAnotar();
      }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, [abrirBusca, abrirAnotar]);

  return (
    <>
      {janelas.anotar.aberto && <AnotarRapidoModal />}
      {janelas.busca && <BuscaGlobalModal />}
      {janelas.preparar && <PrepararAulaModal turmaId={janelas.preparar.turmaId} data={janelas.preparar.data} />}
    </>
  );
};

const Aplicativo: React.FC = () => {
  const { connectionStatus, authVerificado, currentUser, hasLocalCache, isLoggingIn } = useSupervisao();
  const { tela } = useNavegacao();

  if (connectionStatus === 'CARREGANDO' || !authVerificado) return <Carregando texto="Abrindo a Central…" />;
  // Sem conta conectada, nada é exibido (dados de estudantes ficam protegidos).
  if (!currentUser) return <PrimeiraConexaoView />;
  if (!hasLocalCache) return isLoggingIn ? <Carregando texto="Lendo a planilha…" /> : <PrimeiraConexaoView />;

  // Durante a aula a tela é inteira da chamada (sem menu lateral).
  if (tela.tipo === 'aula') {
    return (
      <>
        <ViewErrorBoundary key={`aula-${tela.turmaId}-${tela.data}`} viewName="aula">
          <ModoSupervisaoView turmaId={tela.turmaId} dataAula={tela.data} />
        </ViewErrorBoundary>
        <Janelas />
        <AvisosGlobais />
      </>
    );
  }

  return (
    <div className="flex h-dvh bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <BarraSuperior />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-24">
            <Conteudo />
          </div>
        </main>
      </div>
      <Janelas />
      <AvisosGlobais />
    </div>
  );
};

export default function App() {
  return (
    <SupervisaoProvider>
      <NavegacaoProvider>
        <Aplicativo />
      </NavegacaoProvider>
    </SupervisaoProvider>
  );
}
