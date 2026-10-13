/**
 * Navegação do app como uma pilha de telas: "Voltar" (inclusive o botão do celular/tablet)
 * sempre retorna à tela anterior, venha de onde vier.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { NavTab } from '../types';

export type AbaTurma = 'alunos' | 'aulas' | 'rss' | 'leituras';

export type Tela =
  | { tipo: 'aba'; aba: NavTab }
  | { tipo: 'turma'; turmaId: string; aba?: AbaTurma }
  | { tipo: 'aula'; turmaId: string; data: string }
  | { tipo: 'aluno'; matriculaId: string; aba?: string };

interface Janelas {
  anotar: { aberto: boolean; matriculaId?: string; turmaId?: string };
  busca: boolean;
  preparar: { turmaId: string; data: string } | null;
}

interface NavegacaoValor {
  tela: Tela;
  podeVoltar: boolean;
  ir: (tela: Tela) => void;
  voltar: () => void;
  abrirAba: (aba: NavTab) => void;
  abrirTurma: (turmaId: string, aba?: AbaTurma) => void;
  abrirAula: (turmaId: string, data: string) => void;
  abrirAluno: (matriculaId: string, aba?: string) => void;
  janelas: Janelas;
  abrirAnotar: (contexto?: { matriculaId?: string; turmaId?: string }) => void;
  fecharAnotar: () => void;
  abrirBusca: () => void;
  fecharBusca: () => void;
  abrirPreparar: (turmaId: string, data: string) => void;
  fecharPreparar: () => void;
}

const NavegacaoContext = createContext<NavegacaoValor | undefined>(undefined);

export const NavegacaoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pilha, setPilha] = useState<Tela[]>([{ tipo: 'aba', aba: 'hoje' }]);
  const pilhaRef = useRef(pilha);
  pilhaRef.current = pilha;
  const [janelas, setJanelas] = useState<Janelas>({ anotar: { aberto: false }, busca: false, preparar: null });

  const ir = useCallback((tela: Tela) => {
    setPilha(p => {
      // Abas do menu reiniciam a pilha: o menu é sempre o "ponto de partida".
      const nova = tela.tipo === 'aba' ? [tela] : [...p, tela];
      return nova.slice(-30);
    });
    try { window.history.pushState({ central: true }, ''); } catch { /* ambiente sem histórico */ }
    window.scrollTo?.(0, 0);
  }, []);

  const voltar = useCallback(() => {
    setPilha(p => (p.length > 1 ? p.slice(0, -1) : [{ tipo: 'aba', aba: 'hoje' }]));
  }, []);

  useEffect(() => {
    const aoVoltarNoNavegador = () => {
      if (pilhaRef.current.length > 1) setPilha(p => p.slice(0, -1));
    };
    window.addEventListener('popstate', aoVoltarNoNavegador);
    return () => window.removeEventListener('popstate', aoVoltarNoNavegador);
  }, []);

  const valor: NavegacaoValor = {
    tela: pilha[pilha.length - 1],
    podeVoltar: pilha.length > 1,
    ir,
    voltar,
    abrirAba: aba => ir({ tipo: 'aba', aba }),
    abrirTurma: (turmaId, aba) => ir({ tipo: 'turma', turmaId, aba }),
    abrirAula: (turmaId, data) => ir({ tipo: 'aula', turmaId, data }),
    abrirAluno: (matriculaId, aba) => ir({ tipo: 'aluno', matriculaId, aba }),
    janelas,
    abrirAnotar: ctx => setJanelas(j => ({ ...j, anotar: { aberto: true, ...ctx } })),
    fecharAnotar: () => setJanelas(j => ({ ...j, anotar: { aberto: false } })),
    abrirBusca: () => setJanelas(j => ({ ...j, busca: true })),
    fecharBusca: () => setJanelas(j => ({ ...j, busca: false })),
    abrirPreparar: (turmaId, data) => setJanelas(j => ({ ...j, preparar: { turmaId, data } })),
    fecharPreparar: () => setJanelas(j => ({ ...j, preparar: null })),
  };

  return <NavegacaoContext.Provider value={valor}>{children}</NavegacaoContext.Provider>;
};

export const useNavegacao = () => {
  const ctx = useContext(NavegacaoContext);
  if (!ctx) throw new Error('useNavegacao deve ser usado dentro de NavegacaoProvider');
  return ctx;
};
