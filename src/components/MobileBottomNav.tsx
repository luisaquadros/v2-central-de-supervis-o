import React from 'react';
import { LayoutDashboard, Users, ClipboardCheck, Award, Menu } from 'lucide-react';

type Action = 'hoje' | 'turmas' | 'aula' | 'avaliacao' | 'menu';

export function MobileBottomNav({ selected, onSelect }: {
  selected: Action;
  onSelect: (action: Action) => void;
}) {
  const tabs = [
    { id: 'hoje', label: 'Hoje', icon: LayoutDashboard },
    { id: 'turmas', label: 'Turmas', icon: Users },
    { id: 'aula', label: 'Aula', icon: ClipboardCheck },
    { id: 'avaliacao', label: 'Avaliar', icon: Award },
    { id: 'menu', label: 'Mais', icon: Menu },
  ] as const;
  return (
    <nav aria-label="Navegação rápida"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-slate-200 shadow-[0_-3px_20px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 px-1.5 py-1.5 gap-0.5">
        {tabs.map(({id,label,icon: Icon}) => (
          <button key={id} type="button" onClick={()=>onSelect(id)}
            aria-current={selected===id ? 'page' : undefined}
            className={`flex flex-col gap-1 justify-center items-center min-w-0 min-h-[52px] rounded-xl text-[11px] font-semibold ${selected===id
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon aria-hidden="true" className="w-5 h-5 shrink-0"/>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
