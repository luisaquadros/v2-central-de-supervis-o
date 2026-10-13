import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
type Tema = 'light' | 'dark' | 'system';
const KEY = 'cs_visual_theme';
const atual = (): Tema => {
  try { const value = localStorage.getItem(KEY); return value === 'light' || value === 'dark' ? value : 'system'; }
  catch { return 'system'; }
};
export function ThemeControl() {
  const [tema, setTema] = useState<Tema>(atual);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      document.documentElement.dataset.theme = tema === 'dark' || (tema === 'system' && mql.matches)
        ? 'dark' : 'light';
      document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
    };
    aplicar();
    mql.addEventListener('change', aplicar);
    return () => mql.removeEventListener('change', aplicar);
  }, [tema]);
  const mudar = (next: Tema) => {
    setTema(next);
    try { localStorage.setItem(KEY, next); } catch {}
  };
  const proximo = tema === 'system' ? 'light' : tema === 'light' ? 'dark' : 'system';
  return <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
    <button type="button" aria-label={`Aparência atual: ${tema}. Alterar para ${proximo}`}
      title={`Aparência: ${tema}`}
      onClick={()=>mudar(proximo)}
      className="flex sm:hidden items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-slate-50">
      {tema === 'dark' ? <Moon className="w-4 h-4"/> : tema === 'light' ? <Sun className="w-4 h-4"/> : <Monitor className="w-4 h-4"/>}
    </button>
    <label className="hidden sm:flex items-center gap-1.5">
    {tema === 'dark' ? <Moon className="w-4 h-4" aria-hidden /> :
      tema === 'light' ? <Sun className="w-4 h-4" aria-hidden /> : <Monitor className="w-4 h-4" aria-hidden />}
    <span className="sr-only">Aparência</span>
    <select aria-label="Aparência do aplicativo" value={tema}
      onChange={e => mudar(e.target.value as Tema)}
      className="theme-selector min-h-10 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-500">
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
    </select>
    </label>
  </div>;
}
