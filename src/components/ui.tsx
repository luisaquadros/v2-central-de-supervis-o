/**
 * Kit visual único do app: mesmos botões, cartões e janelas em todas as telas.
 * Pensado para tablet/celular: alvos de toque ≥ 40px e texto legível (mín. 13px).
 */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

type Variante = 'primario' | 'secundario' | 'perigo' | 'sucesso' | 'fantasma' | 'destaque';

const ESTILO_BOTAO: Record<Variante, string> = {
  primario: 'bg-slate-900 text-white hover:bg-slate-800',
  secundario: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700',
  fantasma: 'text-slate-700 hover:bg-slate-100',
  destaque: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
};

export const Botao: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: 'sm' | 'md' | 'lg';
  icone?: React.ReactNode;
}> = ({ variante = 'secundario', tamanho = 'md', icone, className = '', children, ...props }) => {
  const tam = tamanho === 'sm' ? 'min-h-9 px-3 text-sm' : tamanho === 'lg' ? 'min-h-12 px-5 text-base' : 'min-h-10 px-4 text-sm';
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${ESTILO_BOTAO[variante]} ${tam} ${className}`}
    >
      {icone}
      {children}
    </button>
  );
};

export const Cartao: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div {...props} className={`bg-white border border-slate-200 rounded-2xl ${className}`} />
);

export const Secao: React.FC<{
  titulo: React.ReactNode;
  icone?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ titulo, icone, acao, children, className = '' }) => (
  <Cartao className={`p-4 sm:p-5 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">{icone}{titulo}</h2>
      {acao}
    </div>
    {children}
  </Cartao>
);

const CORES_SELO = {
  cinza: 'bg-slate-100 text-slate-700',
  vermelho: 'bg-red-100 text-red-800',
  ambar: 'bg-amber-100 text-amber-900',
  verde: 'bg-emerald-100 text-emerald-800',
  azul: 'bg-blue-100 text-blue-800',
  roxo: 'bg-violet-100 text-violet-800',
} as const;

export const Selo: React.FC<{ cor?: keyof typeof CORES_SELO; children: React.ReactNode; className?: string; title?: string }> = ({
  cor = 'cinza', children, className = '', title,
}) => (
  <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${CORES_SELO[cor]} ${className}`}>
    {children}
  </span>
);

export const Vazio: React.FC<{ icone?: React.ReactNode; titulo: string; texto?: string; children?: React.ReactNode }> = ({ icone, titulo, texto, children }) => (
  <div className="py-8 px-4 text-center">
    {icone && <div className="mx-auto mb-2 w-fit text-slate-400">{icone}</div>}
    <p className="font-semibold text-slate-700">{titulo}</p>
    {texto && <p className="text-sm text-slate-500 mt-1">{texto}</p>}
    {children && <div className="mt-3">{children}</div>}
  </div>
);

export const Janela: React.FC<{
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  aoFechar: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: 'sm' | 'md' | 'lg';
}> = ({ titulo, subtitulo, aoFechar, children, rodape, largura = 'md' }) => {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);
  const max = largura === 'sm' ? 'max-w-md' : largura === 'lg' ? 'max-w-3xl' : 'max-w-xl';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50" onMouseDown={e => e.target === e.currentTarget && aoFechar()}>
      <div role="dialog" aria-modal="true" className={`bg-white w-full ${max} rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]`}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
            {subtitulo && <p className="text-sm text-slate-500 mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={aoFechar} aria-label="Fechar" className="p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {rodape && <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">{rodape}</div>}
      </div>
    </div>
  );
};

export const Abas = <T extends string>({ abas, ativa, aoMudar }: {
  abas: { id: T; rotulo: string; contador?: number }[];
  ativa: T;
  aoMudar: (id: T) => void;
}) => (
  <div className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-1 px-1" role="tablist">
    {abas.map(a => (
      <button
        key={a.id}
        role="tab"
        aria-selected={a.id === ativa}
        onClick={() => aoMudar(a.id)}
        className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${
          a.id === ativa ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        {a.rotulo}
        {a.contador !== undefined && a.contador > 0 && (
          <span className="ml-1.5 rounded-full bg-amber-100 text-amber-900 px-1.5 text-xs">{a.contador}</span>
        )}
      </button>
    ))}
  </div>
);

export const Campo: React.FC<{ rotulo: string; children: React.ReactNode; dica?: string }> = ({ rotulo, children, dica }) => (
  <label className="block">
    <span className="text-sm font-semibold text-slate-700">{rotulo}</span>
    <div className="mt-1">{children}</div>
    {dica && <span className="text-xs text-slate-500 mt-1 block">{dica}</span>}
  </label>
);

export const CLASSE_INPUT = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-slate-900';
