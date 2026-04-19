import { Link } from 'react-router-dom';
import { useJobEvents } from '../hooks/useJobEvents';

const dots: Record<string, string> = {
  PENDING: '#666', SCHEDULED: '#0070f3', QUEUED: '#f5a623',
  RUNNING: '#79ffe1', COMPLETED: '#50e3c2', FAILED: '#ee0000',
  RETRYING: '#f97316', DEAD_LETTER: '#ee0000',
};

export function LiveFeedPage() {
  const events = useJobEvents(100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Live</p>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--green)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
          Connected
        </span>
      </div>

      {events.length === 0 ? (
        <p className="py-16 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Waiting for events...
        </p>
      ) : (
        <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
          {events.map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-[5px] text-[12px]">
              <span className="tabular-nums" style={{ color: 'var(--text-muted)', width: 60 }}>
                {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="shrink-0 rounded-full" style={{ width: 5, height: 5, background: dots[e.to] || '#666' }} />
              <span style={{ color: 'var(--text-muted)' }}>{e.from}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ color: 'var(--text-secondary)' }}>{e.to}</span>
              <Link to={`/jobs/${e.jobId}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                {e.jobId.slice(-8)}
              </Link>
              {e.workerId && <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{e.workerId}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
