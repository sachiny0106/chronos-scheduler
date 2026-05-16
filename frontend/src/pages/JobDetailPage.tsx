import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJob, getJobExecutions } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [execs, setExecs] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getJob(id).then(setJob).catch(e => setErr(e.message));
    getJobExecutions(id).then(setExecs).catch(() => {});
  }, [id]);

  if (err) return <p className="py-20 text-center" style={{ color: 'var(--red)' }}>{err}</p>;
  if (!job) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  );

  const fields = [
    ['Type', job.type], ['Priority', job.priority],
    ['Retries', `${job.retryCount} / ${job.maxRetries}`], ['Backoff', job.retryBackoff],
    ['Timeout', `${job.timeout / 1000}s`], ['Run at', format(new Date(job.runAt), 'MMM d, HH:mm:ss')],
    ['Created', format(new Date(job.createdAt), 'MMM d, HH:mm:ss')], ['Worker', job.workerId || '—'],
  ];

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={16} /> Back to Jobs
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{job.name}</h1>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-4 text-gray-500 border-b border-gray-100 pb-2">Configuration</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
              {fields.map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>{val}</p>
                </div>
              ))}
              {job.cronExpression && (
                <div className="col-span-full">
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Cron Expression</p>
                  <code className="text-[13px] bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-800 font-mono">{job.cronExpression}</code>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-4 text-gray-500 border-b border-gray-100 pb-2">Execution History <span className="text-gray-400 font-normal">({execs.length})</span></h2>
            {execs.length === 0 ? (
              <p className="py-6 text-[13px] text-center" style={{ color: 'var(--text-muted)' }}>No execution history available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50">
                      {['Result', 'Worker', 'Duration', 'Time', 'Error'].map(h => (
                        <th key={h} className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-100" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {execs.map(ex => (
                      <tr key={ex.executionId} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 text-[13px] font-medium" style={{ color: ex.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)' }}>
                          {ex.status === 'SUCCESS' ? 'Success' : 'Failed'}
                        </td>
                        <td className="py-3 px-3 text-[12px] font-mono text-gray-500">{ex.workerId}</td>
                        <td className="py-3 px-3 text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{ex.duration}ms</td>
                        <td className="py-3 px-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>{format(new Date(ex.startedAt), 'HH:mm:ss')}</td>
                        <td className="py-3 px-3 text-[13px] truncate max-w-[200px]" style={{ color: 'var(--red)' }}>{ex.error?.message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-4 text-gray-500 border-b border-gray-100 pb-2">Payload</h2>
            {job.payload && Object.keys(job.payload).length > 0 ? (
              <pre className="text-[12px] rounded-md px-4 py-3 overflow-x-auto bg-gray-50 border border-gray-200 text-gray-700 font-mono">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            ) : (
              <p className="text-[13px] italic text-gray-400">Empty payload</p>
            )}
          </div>
          
          <div className="glass-card p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-4 text-gray-500 border-b border-gray-100 pb-2">Metadata</h2>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Job ID</p>
                <code className="text-[12px] bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-800 font-mono break-all">{job._id}</code>
              </div>
              {job.idempotencyKey && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Idempotency Key</p>
                  <code className="text-[12px] bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-800 font-mono break-all">{job.idempotencyKey}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
