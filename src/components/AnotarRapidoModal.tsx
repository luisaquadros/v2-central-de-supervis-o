import React, { useMemo, useState } from 'react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { interpretarAnotacao, ROTULO_TIPO_ANOTACAO, TipoAnotacao } from '../services/interpretarAnotacao';
import { aulasDoDia, formatarDiaCurto, somarDias } from '../services/supervisaoOperacionalService';
import { textoComparavel } from '../services/normalizacaoPlanilha';
import { Botao, CLASSE_INPUT, Campo, Janela } from './ui';

const TIPOS: TipoAnotacao[] = ['JUSTIFICATIVA', 'FALTA', 'ATRASO', 'CELULAR', 'DOCUMENTO', 'ORIENTACAO', 'LEMBRETE'];

/**
 * "Anotar" (tecla N): escreva do jeito que vier; o app sugere onde registrar.
 * Nada é gravado sem você confirmar. Se não souber onde vai, vira lembrete.
 */
export const AnotarRapidoModal: React.FC = () => {
  const {
    getTurmasDoPeriodo, getAlunosDaTurma, hojeIso, horariosTurma, encontrosTurma, frequencias, matriculas, entregas,
    atualizarFrequencia, addOcorrencia, addOrientacao, addTarefa, atualizarEntregas, addEntrega,
  } = useSupervisao();
  const { janelas, fecharAnotar } = useNavegacao();
  const [texto, setTexto] = useState('');
  const [tipoManual, setTipoManual] = useState<TipoAnotacao | null>(null);
  const [matriculaManual, setMatriculaManual] = useState<string | null>(janelas.anotar.matriculaId || null);
  const [dataManual, setDataManual] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const estudantes = useMemo(() => getTurmasDoPeriodo().flatMap(t => getAlunosDaTurma(t.turma_id)), [getTurmasDoPeriodo, getAlunosDaTurma]);
  const sugestao = useMemo(() => interpretarAnotacao(texto, estudantes, hojeIso), [texto, estudantes, hojeIso]);
  const tipo = tipoManual || (texto.trim() ? sugestao.tipo : 'LEMBRETE');
  const matriculaId = matriculaManual ?? sugestao.matriculaId ?? '';
  const estudante = estudantes.find(e => e.matricula.matricula_id === matriculaId);
  const precisaEstudante = tipo !== 'LEMBRETE';
  const precisaData = tipo === 'FALTA' || tipo === 'JUSTIFICATIVA';

  // Falta/justificativa vão para o dia de aula da turma mais próximo da data citada.
  const dataAula = useMemo(() => {
    if (dataManual) return dataManual;
    if (!estudante) return sugestao.data;
    const turma = getTurmasDoPeriodo().find(t => t.turma_id === estudante.matricula.turma_id);
    if (!turma) return sugestao.data;
    const temAula = (d: string) => aulasDoDia(d, [turma], horariosTurma, encontrosTurma, frequencias, matriculas).some(a => a.situacao === 'PREVISTA');
    for (let i = 0; i <= 7; i++) {
      const d = somarDias(sugestao.data, sugestao.futuro ? i : -i);
      if (temAula(d)) return d;
    }
    return sugestao.data;
  }, [dataManual, estudante, sugestao, getTurmasDoPeriodo, horariosTurma, encontrosTurma, frequencias, matriculas]);

  const [buscaEstudante, setBuscaEstudante] = useState('');
  const opcoes = buscaEstudante
    ? estudantes.filter(e => textoComparavel(e.aluno.nome).includes(textoComparavel(buscaEstudante))).slice(0, 6)
    : sugestao.candidatos.map(c => estudantes.find(e => e.matricula.matricula_id === c.matriculaId)!).filter(Boolean);

  const registrar = async (comoLembrete = false) => {
    const t = texto.trim();
    if (!t) return;
    setSalvando(true);
    try {
      if (comoLembrete || tipo === 'LEMBRETE' || !estudante) {
        await addTarefa({ titulo: t.slice(0, 140), detalhe: t, matricula_id: estudante?.matricula.matricula_id, turma_id: estudante?.matricula.turma_id, origem: 'ANOTACAO' });
      } else if (tipo === 'JUSTIFICATIVA') {
        await atualizarFrequencia(matriculaId, dataAula, 'JUSTIFICATIVA_PENDENTE', t);
      } else if (tipo === 'FALTA') {
        await atualizarFrequencia(matriculaId, dataAula, 'FALTA_SEM_JUSTIFICATIVA', '');
      } else if (tipo === 'ATRASO') {
        await addOcorrencia(matriculaId, 'ATRASO', t);
      } else if (tipo === 'CELULAR') {
        await addOcorrencia(matriculaId, 'USO_INADEQUADO_DISPOSITIVO', t);
      } else if (tipo === 'ORIENTACAO') {
        await addOrientacao(matriculaId, 'Geral', t);
      } else if (tipo === 'DOCUMENTO') {
        const doc = entregas.find(e => e.matricula_id === matriculaId && (e.tipo_documento === sugestao.tipoDocumento) && e.situacao !== 'ENTREGUE');
        if (doc) await atualizarEntregas([String(doc.entrega_id)], 'ENTREGUE');
        else await addEntrega(matriculaId, sugestao.tipoDocumento || 'DOCUMENTACAO_EXTERNA', 'ENTREGUE');
      }
      fecharAnotar();
    } catch {
      // aviso de erro já exibido; o texto continua na tela
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Janela
      titulo="Anotar"
      subtitulo="Escreva do jeito que vier. Você confirma antes de registrar."
      aoFechar={fecharAnotar}
      rodape={<>
        {tipo !== 'LEMBRETE' && <Botao onClick={() => void registrar(true)} disabled={salvando || !texto.trim()}>Só guardar como lembrete</Botao>}
        <Botao variante="primario" onClick={() => void registrar()} disabled={salvando || !texto.trim() || (precisaEstudante && !estudante)}>
          {salvando ? 'Salvando…' : tipo === 'LEMBRETE' ? 'Guardar lembrete' : `Registrar ${ROTULO_TIPO_ANOTACAO[tipo].toLowerCase()}`}
        </Botao>
      </>}
    >
      <div className="space-y-4">
        <textarea autoFocus className={`${CLASSE_INPUT} h-28`} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Ex.: Ana mandou atestado da falta de ontem · Pedro entregou o termo · lembrar de pedir o cronograma" />

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1.5">Registrar como</p>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map(t => (
              <button key={t} onClick={() => setTipoManual(t)}
                className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${tipo === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}>
                {ROTULO_TIPO_ANOTACAO[t]}
              </button>
            ))}
          </div>
        </div>

        {(precisaEstudante || estudante) && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1.5">
              Estudante {estudante ? <span className="text-emerald-700">· {estudante.aluno.nome}</span> : precisaEstudante && <span className="text-amber-700">· escolha abaixo</span>}
            </p>
            <input className={CLASSE_INPUT} value={buscaEstudante} onChange={e => setBuscaEstudante(e.target.value)} placeholder="Buscar estudante pelo nome…" />
            {opcoes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {opcoes.map(o => (
                  <button key={o.matricula.matricula_id} onClick={() => { setMatriculaManual(o.matricula.matricula_id); setBuscaEstudante(''); }}
                    className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${o.matricula.matricula_id === matriculaId ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-300 text-slate-700'}`}>
                    {o.aluno.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {precisaData && estudante && (
          <Campo rotulo="Aula" dica={`Será registrada na aula de ${formatarDiaCurto(dataAula)}.`}>
            <input type="date" className={CLASSE_INPUT} value={dataAula} onChange={e => setDataManual(e.target.value)} />
          </Campo>
        )}
      </div>
    </Janela>
  );
};
