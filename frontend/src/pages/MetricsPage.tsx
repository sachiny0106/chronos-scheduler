import { useEffect, useState } from 'react';
import { getMetrics } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from 'lucide-react';

const tip = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827', fontSize: 12, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' };
const tick = { fill: '#6b7280', fontSize: 11 };

export function MetricsPage() {
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    getMetrics().then(setM).catch(() => {});
    const t = setInterval(() => getMetrics().then(setM).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, []);

  if (!m) return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
    </div>
  );

  const statusData = Object.entries(m.jobs)
    .filter(([k]) => k !== 'total')
    .map(([name, value]) => ({ name, count: value as number }));

  const durData = Object.entries(m.executions.avgDuration || {}).map(
    ([status, d]: [string, any]) => ({ status, avg: d.avg, count: d.count })
  );

  const hourMap: Record<string, { hour: string; success: number; failure: number }> = {};
  for (const t of m.throughput) {
    const h = `${String(t._id.hour).padStart(2, '0')}:00`;
    if (!hourMap[h]) hourMap[h] = { hour: h, success: 0, failure: 0 };
    t._id.status === 'SUCCESS' ? (hourMap[h].success += t.count) : (hourMap[h].failure += t.count);
  }
  const hourly = Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour));

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Metrics</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analyze system performance and throughput</p>
      </div>

      {/* Summary */}
      {durData.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {durData.map((d: any) => (
              <div key={d.status} className="p-5 bg-white">
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: d.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)' }}>{d.status}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: 'var(--text)' }}>{d.count}</p>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>avg {d.avg}ms</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Job Status Distribution</h2>
          </div>
          {statusData.length === 0 ? (
            <p className="py-8 text-[13px] text-center" style={{ color: 'var(--text-muted)' }}>No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={tick} width={80} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Duration */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <Activity size={18} style={{ color: 'var(--cyan)' }} />
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Average Execution Duration</h2>
          </div>
          {durData.length === 0 ? (
            <p className="py-8 text-[13px] text-center" style={{ color: 'var(--text-muted)' }}>No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={durData} margin={{ left: 0, right: 0 }}>
                <XAxis dataKey="status" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} cursor={{ fill: '#f3f4f6' }} formatter={(v: number) => [`${v}ms`, 'Avg']} />
                <Bar dataKey="avg" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Throughput */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <Activity size={18} style={{ color: 'var(--green)' }} />
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Hourly Throughput (Last 24h)</h2>
        </div>
        {hourly.length === 0 ? (
          <p className="py-12 text-[13px] text-center" style={{ color: 'var(--text-muted)' }}>No data in last 24h</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourly} margin={{ top: 10 }}>
              <XAxis dataKey="hour" tick={tick} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={tick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tip} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="success" name="Success" stackId="a" fill="#10b981" barSize={24} />
              <Bar dataKey="failure" name="Failure" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#4b5563', paddingTop: '20px' }} iconType="circle" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
