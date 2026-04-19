import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJob, getJobExecutions } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowLeft } from 'lucide-react';
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

  if (err) return <p style={{ color: 'var(--red)' }}>{err}</p>;
  if (!job) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;

  const fields = [
    ['Type', job.type], ['Priority', job.priority],
    ['Retries', `${job.retryCount} / ${job.maxRetries}`], ['Backoff', job.retryBackoff],
    ['Timeout', `${job.timeout / 1000}s`], ['Run at', format(new Date(job.runAt), 'MMM d, HH:mm:ss')],
    ['Created', format(new Date(job.createdAt), 'MMM d, HH:mm:ss')], ['Worker', job.workerId || '—'],
  ];

  return (
    <div className="space-y-5">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-[12px] hover:underline" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={12} /> Jobs
      </Link>

      <div className="flex items-center gap-2.5">
        <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>{job.name}</p>
        <StatusBadge status={job.status} />
      </div>

      {/* Fields — flat grid, no card wrapper */}
      <div className="grid grid-cols-4 gap-y-4">
        {fields.map(([label, val]) => (
          <div key={label as string}>
            <p className="text-[11px] uppercase tracking-wider mb-px" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-[13px]" style={{ color: 'var(--text)' }}>{val}</p>
          </div>
        ))}
      </div>

      {job.cronExpression && (
        <div>
          <p className="text-[11px] uppercase tracking-wider mb-px" style={{ color: 'var(--text-muted)' }}>Cron</p>
          <code className="text-[13px]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: 'var(--text)' }}>{job.cronExpression}</code>
        </div>
      )}

      {job.payload && Object.keys(job.payload).length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Payload</p>
          <pre
            className="text-[12px] rounded-[4px] px-3 py-2 overflow-x-auto"
            style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text)' }}>
          Executions <span style={{ color: 'var(--text-muted)' }}>({execs.length})</span>
        </p>

        {execs.length === 0 ? (
          <p className="py-6 text-[12px]" style={{ color: 'var(--text-muted)' }}>No executions yet</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Result', 'Worker', 'Duration', 'Time', 'Error'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[11px] font-normal uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {execs.map(ex => (
                <tr key={ex.executionId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2 px-3 text-[12px] font-medium" style={{ color: ex.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)' }}>
                    {ex.status === 'SUCCESS' ? 'Pass' : 'Fail'}
                  </td>
                  <td className="py-2 px-3 text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{ex.workerId}</td>
                  <td className="py-2 px-3 text-[12px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{ex.duration}ms</td>
                  <td className="py-2 px-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>{format(new Date(ex.startedAt), 'HH:mm:ss')}</td>
                  <td className="py-2 px-3 text-[12px] truncate max-w-[200px]" style={{ color: 'var(--red)' }}>{ex.error?.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
