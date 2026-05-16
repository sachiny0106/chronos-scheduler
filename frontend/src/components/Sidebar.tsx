import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Plus, Radio, Skull, Activity, Settings, Database } from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/jobs', icon: List, label: 'Jobs' },
  { to: '/create', icon: Plus, label: 'New Job' },
  { to: '/live', icon: Radio, label: 'Live' },
  { to: '/dlq', icon: Skull, label: 'Dead Letter' },
  { to: '/metrics', icon: Activity, label: 'Metrics' },
];

export function Sidebar() {
  return (
    <aside className="w-[230px] shrink-0 flex flex-col bg-[#f8fafc] border-r border-gray-200 h-screen sticky top-0">
      <div className="h-[60px] px-5 flex items-center gap-2.5 border-b border-gray-200 bg-white">
        <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
          <Database size={12} className="text-white" />
        </div>
        <span className="text-[14px] font-bold text-slate-900 tracking-tight">Chronos</span>
      </div>

      <div className="px-3 pt-5 pb-2">
        <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Core</p>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `
              flex items-center gap-3 px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors
              ${isActive ? 'bg-white shadow-sm border border-gray-200 text-slate-900' : 'text-slate-600 border border-transparent hover:bg-slate-100/50 hover:text-slate-900'}
            `}
          >
            {({ isActive }) => (
              <>
                <Icon size={14} className={isActive ? 'text-slate-700' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <button className="w-full flex items-center gap-3 px-2.5 py-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100/50 transition-colors">
          <Settings size={14} className="text-slate-400" strokeWidth={2} />
          Settings
        </button>
      </div>
    </aside>
  );
}
