import React, { useState } from 'react';
import { BellPlus, Check, ClipboardCheck, FileText, Play, UserRound, X, BookOpen, Send, UserCheck, CalendarX } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import type { ItemPendenciaOperacional } from '../types';
import { Botao } from './ui';
import { ConferenciaDocumentosModal } from './ConferenciaDocumentosModal';
import { EstudoDirigidoModal } from './EstudoDirigidoModal';

const ICONE: Record<ItemPendenciaOperacional['tipo'], React.ElementType> = {
  CHAMADA: UserCheck,
  JUSTIFICATIVA: FileText,
  RISCO_FALTAS: UserRound,
  DOCUMENTO: FileText,
  DOCUMENTO_CONFERIR: ClipboardCheck,
  ESTUDO_DIRIGIDO: BookOpen,
  DEVOLUTIVA: Send,
};

const COR_URGENCIA = {
  CRITICA: 'border-l-red-500',
  ALTA: 'border-l-amber-500',
  MEDIA: 'border-l-slate-300',
};

/** Uma pendência com o botão que a resolve ali mesmo. */
export const PendenciaItem: React.FC<{ item: ItemPendenciaOperacional; mostrarTurma?: boolean }> = ({ item, mostrarTurma = true }) => {
  const { decidirJustificativa, addTarefa, marcarEncontroNaoRealizado, dispensarChamada, leiturasResponsaveis } = useSupervisao();
  const { abrirAula, abrirAluno, abrirAba } = useNavegacao();
  const [conferir, setConferir] = useState(false);
  const [estudo, setEstudo] = useState(false);
  const Icone = ICONE[item.tipo];
  const leitura = item.leitura_id ? leiturasResponsaveis.find(l => l.leitura_id === item.leitura_id) : undefined;

  return (
    <li className={`bg-white border border-slate-200 border-l-4 ${COR_URGENCIA[item.urgencia]} rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icone className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{item.titulo}</p>
          <p className="text-sm text-slate-600">
            {item.descricao}
            {mostrarTurma && item.turma_nome && item.descricao !== item.turma_nome && !item.titulo.includes(item.turma_nome) && <span className="text-slate-400"> · {item.turma_nome}</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
        {item.tipo === 'CHAMADA' && item.turma_id && item.dataAula && (
          <>
            <Botao variante="primario" tamanho="sm" icone={<Play className="w-4 h-4" />} onClick={() => abrirAula(item.turma_id!, item.dataAula!)}>
              Fazer chamada
            </Botao>
            <Botao tamanho="sm" onClick={() => void dispensarChamada(item.turma_id!, item.dataAula!)} title="A aula aconteceu e a chamada foi lançada no Docente Online">
              Já fiz no Docente
            </Botao>
            <Botao tamanho="sm" variante="fantasma" icone={<CalendarX className="w-4 h-4" />}
              onClick={() => void marcarEncontroNaoRealizado(item.turma_id!, item.dataAula!, 'Aula não realizada')}>
              Não houve aula
            </Botao>
          </>
        )}
        {item.tipo === 'JUSTIFICATIVA' && item.frequencia_id && (
          <>
            <Botao variante="sucesso" tamanho="sm" icone={<Check className="w-4 h-4" />} onClick={() => void decidirJustificativa(item.frequencia_id!, true)}>Aceitar</Botao>
            <Botao tamanho="sm" icone={<X className="w-4 h-4" />} onClick={() => void decidirJustificativa(item.frequencia_id!, false)}>Recusar</Botao>
          </>
        )}
        {item.tipo === 'RISCO_FALTAS' && item.matricula_id && (
          <>
            <Botao tamanho="sm" onClick={() => abrirAluno(item.matricula_id!, 'frequencia')}>Ver faltas</Botao>
            <Botao tamanho="sm" icone={<BellPlus className="w-4 h-4" />}
              onClick={() => void addTarefa({
                titulo: `Conversar com ${item.aluno_nome} sobre faltas`, matricula_id: item.matricula_id, turma_id: item.turma_id,
                duracao_minutos: 15, prioridade: 'ALTA', categoria: 'Frequência',
              })}>
              Lembrete
            </Botao>
          </>
        )}
        {(item.tipo === 'DOCUMENTO' || item.tipo === 'DOCUMENTO_CONFERIR') && item.entrega_ids && (
          <Botao variante={item.tipo === 'DOCUMENTO_CONFERIR' ? 'primario' : 'secundario'} tamanho="sm"
            icone={<ClipboardCheck className="w-4 h-4" />} onClick={() => setConferir(true)}>
            {item.tipo === 'DOCUMENTO_CONFERIR' ? 'Conferir' : 'Ver lista'}
          </Botao>
        )}
        {item.tipo === 'ESTUDO_DIRIGIDO' && leitura && (
          <Botao variante="primario" tamanho="sm" onClick={() => setEstudo(true)}>Registrar</Botao>
        )}
        {item.tipo === 'DEVOLUTIVA' && (
          <Botao variante="primario" tamanho="sm" icone={<Send className="w-4 h-4" />} onClick={() => abrirAba('avaliacao')}>Abrir</Botao>
        )}
      </div>

      {conferir && item.entrega_ids && <ConferenciaDocumentosModal entregaIds={item.entrega_ids} aoFechar={() => setConferir(false)} />}
      {estudo && leitura && <EstudoDirigidoModal leitura={leitura} aoFechar={() => setEstudo(false)} />}
    </li>
  );
};
