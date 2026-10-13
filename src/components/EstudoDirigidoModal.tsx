import React, { useState } from 'react';
import { useSupervisao } from '../context/SupervisaoContext';
import { formatarDataBr } from '../services/supervisaoOperacionalService';
import type { LeituraResponsavel } from '../types';
import { Botao, CLASSE_INPUT, Campo, Janela } from './ui';

type Status = 'REALIZADO' | 'PARCIAL' | 'NAO_REALIZADO' | 'SUBSTITUICAO';

const OPCOES: { id: Status; rotulo: string }[] = [
  { id: 'REALIZADO', rotulo: 'Apresentado' },
  { id: 'PARCIAL', rotulo: 'Parcial' },
  { id: 'NAO_REALIZADO', rotulo: 'Não apresentado' },
  { id: 'SUBSTITUICAO', rotulo: 'Outra pessoa apresentou' },
];

/** Registro do estudo dirigido: quem apresentou de fato. Grava só as colunas de realização. */
export const EstudoDirigidoModal: React.FC<{ leitura: LeituraResponsavel; aoFechar: () => void }> = ({ leitura, aoFechar }) => {
  const { atualizarStatusEstudoDirigido, getResponsaveisLeitura, getAlunosDaTurma } = useSupervisao();
  const previstos = getResponsaveisLeitura(leitura);
  const [status, setStatus] = useState<Status>((leitura.status_realizacao as Status) || 'REALIZADO');
  const [quem, setQuem] = useState<string[]>(
    leitura.responsaveis_efetivos?.length ? leitura.responsaveis_efetivos : previstos.map(p => p.nome)
  );
  const [motivo, setMotivo] = useState(leitura.motivo_substituicao || '');
  const [salvando, setSalvando] = useState(false);
  const turma = getAlunosDaTurma(leitura.turma_id || '');

  const alternar = (nome: string) => setQuem(q => (q.includes(nome) ? q.filter(n => n !== nome) : [...q, nome]));

  const salvar = async () => {
    setSalvando(true);
    try {
      await atualizarStatusEstudoDirigido(String(leitura.leitura_id), status, status === 'NAO_REALIZADO' ? [] : quem, motivo);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Janela
      titulo="Estudo dirigido"
      subtitulo={`${leitura.tema || leitura.titulo} · ${formatarDataBr(leitura.data)}`}
      aoFechar={aoFechar}
      rodape={<>
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao variante="primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </>}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Previsto: <strong className="text-slate-800">{previstos.map(p => p.nome).join(', ') || 'sem responsável definido'}</strong>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {OPCOES.map(o => (
            <Botao key={o.id} variante={status === o.id ? 'primario' : 'secundario'} onClick={() => setStatus(o.id)}>{o.rotulo}</Botao>
          ))}
        </div>
        {status !== 'NAO_REALIZADO' && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Quem apresentou</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...previstos.map(p => p.nome), ...turma.map(t => t.aluno.nome)])].map(nome => (
                <button key={nome} onClick={() => alternar(nome)}
                  className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${quem.includes(nome) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
                  {nome}
                </button>
              ))}
            </div>
          </div>
        )}
        {(status === 'SUBSTITUICAO' || status === 'NAO_REALIZADO' || status === 'PARCIAL') && (
          <Campo rotulo="Motivo (opcional)">
            <input className={CLASSE_INPUT} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: atestado, troca combinada…" />
          </Campo>
        )}
      </div>
    </Janela>
  );
};
