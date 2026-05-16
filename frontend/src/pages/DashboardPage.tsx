import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMetrics } from '../lib/api';
import { useJobEvents } from '../hooks/useJobEvents';
import { StatusBadge } from '../components/StatusBadge';
import { Loader2 } from 'lucide-react';

export function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState('');
  const events = useJobEvents(12);

  useEffect(() => {
    getMetrics().then(setM).catch(e => setErr(e.message));
    const t = setInterval(() => getMetrics().then(setM).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  if (err) return <div className="p-8 text-[13px] text-red-600 border border-red-200 bg-red-50 rounded">{err}</div>;
  if (!m) return (
    <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-3">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-[13px]">Loading metrics...</span>
    </div>
  );

  const stats = [
    { id: 'TOTAL', label: 'Total Jobs', val: m.jobs.total },
    { id: 'COMPLETED', label: 'Completed', val: m.jobs.COMPLETED || 0 },
    { id: 'RUNNING', label: 'Running', val: m.jobs.RUNNING || 0 },
    { id: 'FAILED', label: 'Failed', val: m.jobs.FAILED || 0 },
    { id: 'QUEUED', label: 'Queued', val: m.jobs.QUEUED || 0 },
    { id: 'DEAD_LETTER', label: 'Dead Letter', val: m.jobs.DEAD_LETTER || 0 },
  ];

  return (
    <div className="max-w-[1200px] w-full pb-16">
      <header className="mb-6 pb-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[12px] font-medium text-gray-500">System Normal</span>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(({ id, label, val }) => (
          <div key={id} className="glass-card p-4 flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</span>
            <span className="text-[24px] font-medium tracking-tight text-gray-900 tabular-nums leading-none mt-auto">
              {val.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stream */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-gray-900">Event Stream</h2>
            <span className="text-[11px] text-gray-400 font-mono">Live</span>
          </div>
          
          <div className="glass-card overflow-hidden flex-1">
            {events.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-gray-500">
                No events recorded.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-gray-200">
                    <th className="py-2 px-4 text-[11px] font-medium text-gray-500 w-[100px]">Time</th>
                    <th className="py-2 px-4 text-[11px] font-medium text-gray-500 w-[120px]">Job ID</th>
                    <th className="py-2 px-4 text-[11px] font-medium text-gray-500">Transition</th>
                    <th className="py-2 px-4 text-[11px] font-medium text-gray-500 text-right">Worker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-2.5 px-4 text-[12px] text-gray-400 font-mono whitespace-nowrap">
                        {new Date(e.timestamp).toISOString().split('T')[1].slice(0, -1)}
                      </td>
                      <td className="py-2.5 px-4">
                        <Link to={`/jobs/${e.jobId}`} className="text-[12px] font-mono text-blue-600 hover:underline">
                          {e.jobId.slice(-8)}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 flex items-center gap-2 text-[12px]">
                        <span className="text-gray-500 w-[80px] truncate">{e.from}</span>
                        <span className="text-gray-300">→</span>
                        <div className="w-[90px]"><StatusBadge status={e.to} /></div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {e.workerId ? (
                          <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                            {e.workerId.slice(0, 12)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* System Details */}
        <div className="flex flex-col">
          <div className="mb-3">
            <h2 className="text-[13px] font-semibold text-gray-900">Infrastructure</h2>
          </div>
          <div className="glass-card p-0 divide-y divide-gray-100">
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="text-[13px] text-gray-600 font-medium">Active Workers</span>
              <span className="text-[14px] font-semibold text-gray-900 tabular-nums">0</span>
            </div>
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="text-[13px] text-gray-600 font-medium">Uptime</span>
              <span className="text-[14px] font-semibold text-emerald-600 tabular-nums">99.99%</span>
            </div>
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="text-[13px] text-gray-600 font-medium">Version</span>
              <span className="text-[12px] font-mono text-gray-500">v1.2.4-stable</span>
            </div>
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="text-[13px] text-gray-600 font-medium">Region</span>
              <span className="text-[12px] font-mono text-gray-500">us-east-1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
