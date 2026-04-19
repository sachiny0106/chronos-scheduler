import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Plus, Radio, Skull, Activity, Clock } from 'lucide-react';

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
    <aside className="w-[200px] shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
      <div className="h-12 px-4 flex items-center gap-2">
        <Clock size={15} style={{ color: 'var(--accent)' }} />
        <span className="text-[13px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Chronos</span>
      </div>

      <nav className="flex-1 px-3 mt-0.5">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex items-center gap-2 px-2 py-[5px] rounded-[4px] text-[13px] transition-colors"
            style={({ isActive }) => ({
              color: isActive ? 'var(--text)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-hover)' : undefined,
            })}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
