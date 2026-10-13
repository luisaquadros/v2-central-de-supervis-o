import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { nomeTipoEntrega } from '../services/supervisaoOperacionalService';
import type { SituacaoEntrega } from '../types';
import { Botao, Janela, Selo } from './ui';

const ROTULO: Record<SituacaoEntrega, { texto: string; cor: 'verde' | 'ambar' | 'vermelho' | 'cinza' }> = {
  ENTREGUE: { texto: 'Conferido', cor: 'verde' },
  A_CONFERIR: { texto: 'A conferir', cor: 'ambar' },
  PENDENTE: { texto: 'Não entregue', cor: 'vermelho' },
  NAO_SE_APLICA: { texto: 'Não se aplica', cor: 'cinza' },
};

/** Conferência rápida de documentos: um toque por estudante (grava só a coluna status). */
export const ConferenciaDocumentosModal: React.FC<{ entregaIds: string[]; aoFechar: () => void }> = ({ entregaIds, aoFechar }) => {
  const { entregas, matriculas, alunos, atualizarEntregas } = useSupervisao();
  const lista = useMemo(() => {
    const ids = new Set(entregaIds);
    return entregas
      .filter(e => ids.has(String(e.entrega_id)))
      .map(e => {
        const mat = matriculas.find(m => m.matricula_id === e.matricula_id);
        return { entrega: e, nome: alunos.find(a => a.aluno_id === mat?.aluno_id)?.nome || 'Estudante' };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [entregaIds, entregas, matriculas, alunos]);

  const tipo = nomeTipoEntrega(lista[0]?.entrega.tipo_documento);
  const aConferir = lista.filter(l => l.entrega.situacao !== 'ENTREGUE' && l.entrega.situacao !== 'NAO_SE_APLICA');

  return (
    <Janela
      titulo={`Conferir: ${tipo}`}
      subtitulo={`${aConferir.length} de ${lista.length} ainda sem conferência`}
      aoFechar={aoFechar}
      largura="lg"
      rodape={<>
        <Botao onClick={aoFechar}>Fechar</Botao>
        {aConferir.length > 0 && (
          <Botao variante="sucesso" icone={<Check className="w-4 h-4" />}
            onClick={() => void atualizarEntregas(aConferir.map(l => String(l.entrega.entrega_id)), 'ENTREGUE')}>
            Marcar todos como conferidos
          </Botao>
        )}
      </>}
    >
      <ul className="divide-y divide-slate-100">
        {lista.map(({ entrega, nome }) => {
          const s = (entrega.situacao || 'PENDENTE') as SituacaoEntrega;
          const id = String(entrega.entrega_id);
          return (
            <li key={id} className="py-2.5 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-40 font-medium text-slate-900">{nome}</span>
              <Selo cor={ROTULO[s].cor}>{ROTULO[s].texto}</Selo>
              <div className="flex gap-1.5">
                <Botao tamanho="sm" variante={s === 'ENTREGUE' ? 'sucesso' : 'secundario'} onClick={() => void atualizarEntregas([id], 'ENTREGUE')}>
                  <Check className="w-4 h-4" /> Ok
                </Botao>
                <Botao tamanho="sm" variante={s === 'PENDENTE' ? 'perigo' : 'secundario'} onClick={() => void atualizarEntregas([id], 'PENDENTE')}>
                  Falta
                </Botao>
                <Botao tamanho="sm" variante="fantasma" onClick={() => void atualizarEntregas([id], 'NAO_SE_APLICA')} title="Não se aplica">
                  N/A
                </Botao>
              </div>
            </li>
          );
        })}
      </ul>
    </Janela>
  );
};
