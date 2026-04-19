import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDLQ, retryDLQ } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw } from 'lucide-react';

export function DLQPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { setJobs(await listDLQ()); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const retry = async (id: string) => { setRetrying(id); try { await retryDLQ(id); load(); } catch {} setRetrying(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Dead Letter Queue</p>
        {jobs.length > 0 && <span className="text-[11px] tabular-nums" style={{ color: 'var(--red)' }}>{jobs.length}</span>}
      </div>

      {loading ? (
        <p className="py-12 text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="py-16 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          No dead-letter jobs. Jobs land here after exhausting all retry attempts.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Status', 'Attempts', 'Failed', ''].map(h => (
                <th key={h} className="text-left py-2 px-3 text-[11px] font-normal uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr
                key={j._id}
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td className="py-2 px-3">
                  <Link to={`/jobs/${j._id}`} className="text-[13px] hover:underline" style={{ color: 'var(--text)' }}>{j.name}</Link>
                </td>
                <td className="py-2 px-3"><StatusBadge status={j.status} /></td>
                <td className="py-2 px-3 text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{j.retryCount}/{j.maxRetries}</td>
                <td className="py-2 px-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {formatDistanceToNow(new Date(j.updatedAt), { addSuffix: true })}
                </td>
                <td className="py-2 px-3">
                  <button
                    onClick={() => retry(j._id)} disabled={retrying === j._id}
                    className="inline-flex items-center gap-1 text-[12px] hover:underline disabled:opacity-30"
                    style={{ color: 'var(--accent)' }}
                  >
                    <RotateCcw size={10} className={retrying === j._id ? 'animate-spin' : ''} />
                    Retry
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
