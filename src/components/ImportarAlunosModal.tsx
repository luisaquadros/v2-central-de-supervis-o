import React, { useMemo, useState } from 'react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Botao, CLASSE_INPUT, Janela } from './ui';

/** Uma linha por estudante: "Nome" ou "Nome; e-mail" (aceita vírgula ou tabulação, colado da planilha). */
function interpretarLista(texto: string) {
  return texto.split('\n').map(l => l.trim()).filter(Boolean).map(linha => {
    const partes = linha.split(/\t|;|,(?=\s*\S+@)/).map(p => p.trim()).filter(Boolean);
    const email = partes.find(p => /\S+@\S+\.\S+/.test(p)) || '';
    const nome = partes.find(p => p !== email) || '';
    return { nome, email };
  }).filter(l => l.nome);
}

export const ImportarAlunosModal: React.FC<{ turmaId: string; aoFechar: () => void }> = ({ turmaId, aoFechar }) => {
  const { importarAlunosLote, turmas } = useSupervisao();
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<{ adicionados: number; duplicados: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const lista = useMemo(() => interpretarLista(texto), [texto]);

  const importar = async () => {
    setSalvando(true);
    try { setResultado(await importarAlunosLote(turmaId, lista)); setTexto(''); }
    finally { setSalvando(false); }
  };

  return (
    <Janela
      titulo="Adicionar estudantes"
      subtitulo={turmas.find(t => t.turma_id === turmaId)?.nome}
      aoFechar={aoFechar}
      rodape={<>
        <Botao onClick={aoFechar}>Fechar</Botao>
        <Botao variante="primario" onClick={importar} disabled={salvando || lista.length === 0}>
          {salvando ? 'Salvando…' : `Adicionar ${lista.length || ''}`}
        </Botao>
      </>}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Cole uma linha por estudante: <code>Nome completo; e-mail</code>. O e-mail é opcional, mas ajuda a enviar devolutivas. Quem já está na turma é ignorado.</p>
        <textarea className={`${CLASSE_INPUT} h-48 font-mono`} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder={'Maria da Silva; maria@email.com\nJoão Souza'} />
        {lista.length > 0 && <p className="text-sm text-slate-700">{lista.length} estudante(s) reconhecido(s).</p>}
        {resultado && (
          <p className="text-sm bg-emerald-50 text-emerald-900 rounded-xl p-3">
            {resultado.adicionados} adicionado(s){resultado.duplicados > 0 ? `, ${resultado.duplicados} já estavam na turma` : ''}.
          </p>
        )}
      </div>
    </Janela>
  );
};
