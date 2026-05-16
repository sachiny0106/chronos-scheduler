import { Link } from 'react-router-dom';
import { useJobEvents } from '../hooks/useJobEvents';
import { StatusBadge } from '../components/StatusBadge';
import { Radio } from 'lucide-react';

export function LiveFeedPage() {
  const events = useJobEvents(100);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Live Feed</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Real-time stream of all job state transitions</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 glass-card text-xs font-semibold text-green-700 bg-green-50 border-green-200">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Connected
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {events.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Radio size={32} className="text-gray-300 mb-3" />
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Waiting for events to stream in...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-4 py-3 px-6 hover:bg-gray-50 transition-colors">
                <span className="font-mono text-[12px] px-2 py-1 rounded bg-gray-100 text-gray-500 border border-gray-200 w-[80px] text-center">
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                
                <span className="text-[13px] w-24 text-right" style={{ color: 'var(--text-muted)' }}>{e.from}</span>
                <span className="text-gray-300">→</span>
                <div className="w-24 shrink-0"><StatusBadge status={e.to} /></div>
                
                <Link to={`/jobs/${e.jobId}`} className="font-mono text-[13px] hover:underline font-semibold" style={{ color: 'var(--accent)' }}>
                  {e.jobId.slice(-8)}
                </Link>
                
                {e.workerId && (
                  <span className="ml-auto font-mono text-[12px] bg-gray-50 px-2 py-0.5 rounded border border-gray-200" style={{ color: 'var(--text-muted)' }}>
                    {e.workerId}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
