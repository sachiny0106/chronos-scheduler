import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listJobs, deleteJob } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Loader2, List as ListIcon } from 'lucide-react';

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
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Jobs</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage and monitor all your scheduled tasks</p>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Filter tabs */}
        <div className="flex gap-2 p-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {filters.map(f => {
            const isActive = status === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                  }`}
              >
                {f || 'All Jobs'}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50" style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Status', 'Type', 'Priority', 'Scheduled', 'Created', ''].map(h => (
                  <th key={h} className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 size={24} className="mx-auto animate-spin" style={{ color: 'var(--accent)' }} />
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <ListIcon size={32} className="mb-3 text-gray-500" />
                      <p className="text-[13px] text-gray-500">No jobs found for this filter.</p>
                    </div>
                  </td>
                </tr>
              ) : jobs.map(j => (
                <tr
                  key={j._id}
                  className="group hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <Link to={`/jobs/${j._id}`} className="text-[14px] font-medium hover:underline" style={{ color: 'var(--text)' }}>
                      {j.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={j.status} /></td>
                  <td className="py-3 px-4 text-[13px]" style={{ color: 'var(--text-secondary)' }}>{j.type}</td>
                  <td className="py-3 px-4 text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{j.priority}</td>
                  <td className="py-3 px-4 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    {formatDistanceToNow(new Date(j.runAt), { addSuffix: true })}
                  </td>
                  <td className="py-3 px-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}
                  </td>
                  <td className="py-3 px-4 w-12 text-center">
                    {['PENDING', 'SCHEDULED'].includes(j.status) && (
                      <button 
                        onClick={() => { if (confirm('Delete?')) deleteJob(j._id).then(load); }} 
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-gray-400 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 text-[13px]" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Showing page <span className="font-semibold text-gray-900">{page}</span> of <span className="font-semibold text-gray-900">{pages}</span>
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page - 1)); setSp(n); }}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white transition-colors border border-gray-200 shadow-sm font-medium text-gray-700"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page + 1)); setSp(n); }}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white transition-colors border border-gray-200 shadow-sm font-medium text-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
