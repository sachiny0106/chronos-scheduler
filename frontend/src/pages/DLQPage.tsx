import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDLQ, retryDLQ } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, Skull } from 'lucide-react';

export function DLQPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { setJobs(await listDLQ()); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const retry = async (id: string) => { setRetrying(id); try { await retryDLQ(id); load(); } catch {} setRetrying(null); };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Dead Letter Queue</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Jobs that failed after exhausting all retry attempts</p>
        </div>
        {jobs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card text-xs font-semibold text-red-700 bg-red-50 border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {jobs.length} Failed
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <p className="py-24 text-[13px] text-center" style={{ color: 'var(--text-muted)' }}>Loading dead letters...</p>
        ) : jobs.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Skull size={32} className="text-gray-300 mb-3" />
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Queue is empty. Everything is running smoothly.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Status', 'Attempts', 'Failed', ''].map(h => (
                    <th key={h} className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map(j => (
                  <tr key={j._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/jobs/${j._id}`} className="text-[14px] font-medium hover:underline" style={{ color: 'var(--text)' }}>
                        {j.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={j.status} /></td>
                    <td className="py-3 px-4 text-[13px] font-mono" style={{ color: 'var(--text-muted)' }}>{j.retryCount}/{j.maxRetries}</td>
                    <td className="py-3 px-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(j.updatedAt), { addSuffix: true })}
                    </td>
                    <td className="py-3 px-4 w-24 text-right">
                      <button
                        onClick={() => retry(j._id)} disabled={retrying === j._id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border shadow-sm transition-all bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                      >
                        <RotateCcw size={12} className={retrying === j._id ? 'animate-spin' : ''} />
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
