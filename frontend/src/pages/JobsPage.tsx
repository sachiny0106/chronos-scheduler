import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listJobs, deleteJob } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';

const filters = ['', 'PENDING', 'SCHEDULED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER'];

export function JobsPage() {
  const [sp, setSp] = useSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const status = sp.get('status') || '';
  const page = parseInt(sp.get('page') || '1', 10);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = { limit: String(limit), offset: String((page - 1) * limit) };
      if (status) p.status = status;
      const d = await listJobs(p);
      setJobs(d.jobs); setTotal(d.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [status, page]);

  const pages = Math.ceil(total / limit);

  const setFilter = (f: string) => {
    const n = new URLSearchParams(sp);
    f ? n.set('status', f) : n.delete('status');
    n.set('page', '1');
    setSp(n);
  };

  return (
    <div className="space-y-4">
      <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Jobs</p>

      {/* Filter tabs — underline style */}
      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-2 text-[12px] transition-colors relative"
            style={{ color: status === f ? 'var(--text)' : 'var(--text-muted)' }}
          >
            {f || 'All'}
            {status === f && (
              <span className="absolute bottom-0 left-3 right-3 h-px" style={{ background: 'var(--text)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Name', 'Status', 'Type', 'Priority', 'Scheduled', 'Created', ''].map(h => (
              <th key={h} className="text-left py-2 px-3 text-[11px] font-normal uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="py-12 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
          ) : jobs.length === 0 ? (
            <tr><td colSpan={7} className="py-12 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No jobs found</td></tr>
          ) : jobs.map(j => (
            <tr
              key={j._id}
              className="transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <td className="py-2 px-3">
                <Link to={`/jobs/${j._id}`} className="text-[13px] hover:underline" style={{ color: 'var(--text)' }}>{j.name}</Link>
              </td>
              <td className="py-2 px-3"><StatusBadge status={j.status} /></td>
              <td className="py-2 px-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>{j.type}</td>
              <td className="py-2 px-3 text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{j.priority}</td>
              <td className="py-2 px-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {formatDistanceToNow(new Date(j.runAt), { addSuffix: true })}
              </td>
              <td className="py-2 px-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}
              </td>
              <td className="py-2 px-3 w-8">
                {['PENDING', 'SCHEDULED'].includes(j.status) && (
                  <button onClick={() => { if (confirm('Delete?')) deleteJob(j._id).then(load); }} style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination — Prev / Next */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          <button
            disabled={page <= 1}
            onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page - 1)); setSp(n); }}
            className="hover:underline disabled:opacity-30"
            style={{ color: 'var(--accent)' }}
          >
            Prev
          </button>
          <span>{page} / {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page + 1)); setSp(n); }}
            className="hover:underline disabled:opacity-30"
            style={{ color: 'var(--accent)' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
