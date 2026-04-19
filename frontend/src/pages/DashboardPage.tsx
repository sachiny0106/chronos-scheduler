import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMetrics } from '../lib/api';
import { useJobEvents } from '../hooks/useJobEvents';
import { StatusBadge } from '../components/StatusBadge';

export function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState('');
  const events = useJobEvents(10);

  useEffect(() => {
    getMetrics().then(setM).catch(e => setErr(e.message));
    const t = setInterval(() => getMetrics().then(setM).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  if (err) return <p className="py-20 text-center text-[13px]" style={{ color: 'var(--red)' }}>{err}</p>;
  if (!m) return <p className="py-20 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>;

  const stats = [
    { label: 'Total', val: m.jobs.total, color: 'var(--text)' },
    { label: 'Completed', val: m.jobs.COMPLETED || 0, color: 'var(--green)' },
    { label: 'Running', val: m.jobs.RUNNING || 0, color: 'var(--cyan)' },
    { label: 'Failed', val: m.jobs.FAILED || 0, color: 'var(--red)' },
    { label: 'Queued', val: m.jobs.QUEUED || 0, color: 'var(--yellow)' },
    { label: 'Dead Letter', val: m.jobs.DEAD_LETTER || 0, color: 'var(--red)' },
  ];

  return (
    <div className="space-y-5">
      <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Overview</p>

      {/* Stats grid — numbers on black, divided by thin borders */}
      <div className="grid grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, val, color }, i) => (
          <div
            key={label}
            className="py-3 px-4"
            style={{ borderRight: i < stats.length - 1 ? '1px solid var(--border)' : undefined }}
          >
            <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-[20px] font-medium tabular-nums tracking-[-0.02em]" style={{ color }}>{val}</p>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Recent activity */}
      <div>
        <p className="text-[13px] font-medium mb-3 tracking-[-0.01em]" style={{ color: 'var(--text)' }}>Recent activity</p>
        {events.length === 0 ? (
          <p className="py-8 text-[12px]" style={{ color: 'var(--text-muted)' }}>No events yet — create some jobs to see activity here.</p>
        ) : (
          <div className="space-y-0">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 text-[13px]">
                <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-muted)', width: 56 }}>
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <StatusBadge status={e.to} />
                <Link to={`/jobs/${e.jobId}`} className="font-mono text-[11px] hover:underline" style={{ color: 'var(--accent)' }}>
                  {e.jobId.slice(-8)}
                </Link>
                <span style={{ color: 'var(--text-muted)' }}>{e.from} → {e.to}</span>
                {e.workerId && (
                  <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{e.workerId}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
