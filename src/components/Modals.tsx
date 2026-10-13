/**
 * Registros rápidos durante a supervisão. Todos aguardam a gravação no aparelho antes de fechar:
 * se algo falhar, o texto continua na tela (nunca se perde em silêncio).
 */
import React, { useState } from 'react';
import { useSupervisao } from '../context/SupervisaoContext';
import type { Ocorrencia, PontoAcompanhamento } from '../types';
import { Botao, CLASSE_INPUT, Campo, Janela } from './ui';

const CATEGORIAS = ['Clínica', 'Manejo', 'Técnica (TCC)', 'Ética', 'Registro/Relatório', 'Geral'];
const FRASES_RAPIDAS = [
  'Retomar na próxima supervisão.',
  'Revisar a conceitualização do caso.',
  'Definir metas terapêuticas com o paciente.',
  'Atenção ao sigilo e aos registros.',
  'Discutir encaminhamento.',
  'Preparar a devolutiva com o paciente.',
];

function useSalvar(aoConcluir: () => void) {
  const [salvando, setSalvando] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setSalvando(true);
    try {
      await acao();
      aoConcluir();
    } catch {
      // O aviso de erro global já foi mostrado; o formulário permanece aberto com o texto.
    } finally {
      setSalvando(false);
    }
  };
  return { salvando, executar };
}

export const ModalNovaOrientacao: React.FC<{
  matriculaId: string;
  alunoNome: string;
  grupo?: { grupo_id: string; nome_grupo?: string };
  onClose: () => void;
}> = ({ matriculaId, alunoNome, grupo, onClose }) => {
  const { addOrientacao, addOrientacaoGrupo } = useSupervisao();
  const [categoria, setCategoria] = useState('Clínica');
  const [texto, setTexto] = useState('');
  const [paraGrupo, setParaGrupo] = useState(false);
  const [jaResolvida, setJaResolvida] = useState(false);
  const { salvando, executar } = useSalvar(onClose);

  const salvar = () => executar(() => (paraGrupo && grupo
    ? addOrientacaoGrupo(grupo.grupo_id, categoria, texto.trim())
    : addOrientacao(matriculaId, categoria, texto.trim(), jaResolvida ? 'CONCLUÍDA' : 'ABERTA')));

  return (
    <Janela titulo="Orientação" subtitulo={paraGrupo && grupo ? `Grupo: ${grupo.nome_grupo}` : alunoNome} aoFechar={onClose}
      rodape={<>
        <Botao onClick={onClose}>Cancelar</Botao>
        <Botao variante="primario" onClick={salvar} disabled={salvando || !texto.trim()}>{salvando ? 'Salvando…' : 'Registrar'}</Botao>
      </>}>
      <div className="space-y-4">
        {grupo && (
          <div className="flex gap-2">
            <Botao tamanho="sm" variante={!paraGrupo ? 'primario' : 'secundario'} onClick={() => setParaGrupo(false)}>Só {alunoNome.split(' ')[0]}</Botao>
            <Botao tamanho="sm" variante={paraGrupo ? 'primario' : 'secundario'} onClick={() => setParaGrupo(true)}>Grupo inteiro</Botao>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setCategoria(c)}
              className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${categoria === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}>
              {c}
            </button>
          ))}
        </div>
        <textarea autoFocus className={`${CLASSE_INPUT} h-32`} value={texto} onChange={e => setTexto(e.target.value)} placeholder="O que foi orientado…" />
        <div className="flex flex-wrap gap-1.5">
          {FRASES_RAPIDAS.map(f => (
            <button key={f} onClick={() => setTexto(t => (t ? `${t.trim()} ${f}` : f))}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 cursor-pointer">+ {f}</button>
          ))}
        </div>
        {!paraGrupo && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={jaResolvida} onChange={e => setJaResolvida(e.target.checked)} className="w-4 h-4" />
            Já resolvida (não precisa retomar)
          </label>
        )}
      </div>
    </Janela>
  );
};

export const ModalNovoFeedback: React.FC<{ matriculaId: string; alunoNome: string; onClose: () => void }> = ({ matriculaId, alunoNome, onClose }) => {
  const { addFeedback } = useSupervisao();
  const [texto, setTexto] = useState('');
  const { salvando, executar } = useSalvar(onClose);
  return (
    <Janela titulo="Feedback" subtitulo={alunoNome} aoFechar={onClose}
      rodape={<>
        <Botao onClick={onClose}>Cancelar</Botao>
        <Botao variante="primario" onClick={() => executar(() => addFeedback(matriculaId, texto.trim()))} disabled={salvando || !texto.trim()}>{salvando ? 'Salvando…' : 'Registrar'}</Botao>
      </>}>
      <textarea autoFocus className={`${CLASSE_INPUT} h-36`} value={texto} onChange={e => setTexto(e.target.value)}
        placeholder="Pontos fortes, o que desenvolver… (entra na devolutiva do semestre)" />
    </Janela>
  );
};

const TIPOS_OCORRENCIA: { id: Ocorrencia['tipo']; rotulo: string }[] = [
  { id: 'ATRASO', rotulo: 'Atraso' },
  { id: 'USO_INADEQUADO_DISPOSITIVO', rotulo: 'Celular' },
  { id: 'OUTRO', rotulo: 'Outro' },
];

export const ModalRegistrarOcorrencia: React.FC<{ matriculaId: string; alunoNome: string; onClose: () => void }> = ({ matriculaId, alunoNome, onClose }) => {
  const { addOcorrencia } = useSupervisao();
  const [tipo, setTipo] = useState<Ocorrencia['tipo']>('OUTRO');
  const [obs, setObs] = useState('');
  const { salvando, executar } = useSalvar(onClose);
  return (
    <Janela titulo="Ocorrência" subtitulo={alunoNome} aoFechar={onClose} largura="sm"
      rodape={<>
        <Botao onClick={onClose}>Cancelar</Botao>
        <Botao variante="primario" onClick={() => executar(() => addOcorrencia(matriculaId, tipo, obs.trim()))} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</Botao>
      </>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {TIPOS_OCORRENCIA.map(t => <Botao key={t.id} tamanho="sm" variante={tipo === t.id ? 'primario' : 'secundario'} onClick={() => setTipo(t.id)}>{t.rotulo}</Botao>)}
        </div>
        <textarea className={`${CLASSE_INPUT} h-24`} value={obs} onChange={e => setObs(e.target.value)} placeholder="Descrição (opcional)" />
      </div>
    </Janela>
  );
};

export const ModalNovoPontoAcompanhamento: React.FC<{ matriculaId: string; alunoNome: string; onClose: () => void }> = ({ matriculaId, alunoNome, onClose }) => {
  const { addPontoAcompanhamento } = useSupervisao();
  const [texto, setTexto] = useState('');
  const [prioridade, setPrioridade] = useState<PontoAcompanhamento['prioridade']>('MEDIA');
  const { salvando, executar } = useSalvar(onClose);
  return (
    <Janela titulo="Ponto de acompanhamento" subtitulo={`${alunoNome} · algo para observar nas próximas aulas`} aoFechar={onClose} largura="sm"
      rodape={<>
        <Botao onClick={onClose}>Cancelar</Botao>
        <Botao variante="primario" onClick={() => executar(() => addPontoAcompanhamento(matriculaId, texto.trim(), prioridade))} disabled={salvando || !texto.trim()}>{salvando ? 'Salvando…' : 'Criar'}</Botao>
      </>}>
      <div className="space-y-3">
        <Campo rotulo="O que acompanhar">
          <input autoFocus className={CLASSE_INPUT} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: revisar objetividade dos registros" />
        </Campo>
        <div className="flex gap-2">
          {(['ALTA', 'MEDIA', 'BAIXA'] as const).map(p => (
            <Botao key={p} tamanho="sm" variante={prioridade === p ? 'primario' : 'secundario'} onClick={() => setPrioridade(p)}>
              {p === 'ALTA' ? 'Alta' : p === 'MEDIA' ? 'Média' : 'Baixa'}
            </Botao>
          ))}
        </div>
      </div>
    </Janela>
  );
};
