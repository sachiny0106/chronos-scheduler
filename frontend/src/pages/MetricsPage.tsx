import { useEffect, useState } from 'react';
import { getMetrics } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const tip = { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#ededed', fontSize: 12 };
const tick = { fill: '#666', fontSize: 11 };

export function MetricsPage() {
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    getMetrics().then(setM).catch(() => {});
    const t = setInterval(() => getMetrics().then(setM).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, []);

  if (!m) return <p className="py-20 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>;

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
    <div className="space-y-6">
      <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Metrics</p>

      {/* Summary */}
      {durData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4">
          {durData.map((d: any, i: number) => (
            <div key={d.status} className="py-3 px-4" style={{ borderRight: i < durData.length - 1 ? '1px solid var(--border)' : undefined }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: d.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)' }}>{d.status}</p>
              <p className="text-[18px] font-medium tabular-nums" style={{ color: 'var(--text)' }}>{d.count}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>avg {d.avg}ms</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)' }} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div>
          <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text)' }}>Job status</p>
          {statusData.length === 0 ? (
            <p className="py-8 text-[12px]" style={{ color: 'var(--text-muted)' }}>No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} layout="vertical">
                <XAxis type="number" tick={tick} />
                <YAxis type="category" dataKey="name" tick={tick} width={80} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="count" fill="#0070f3" radius={[0, 3, 3, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Duration */}
        <div>
          <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text)' }}>Execution duration</p>
          {durData.length === 0 ? (
            <p className="py-8 text-[12px]" style={{ color: 'var(--text-muted)' }}>No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={durData}>
                <XAxis dataKey="status" tick={tick} />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tip} formatter={(v: number) => [`${v}ms`, 'Avg']} />
                <Bar dataKey="avg" fill="#79ffe1" radius={[3, 3, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Throughput */}
      <div>
        <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text)' }}>Hourly throughput</p>
        {hourly.length === 0 ? (
          <p className="py-8 text-[12px]" style={{ color: 'var(--text-muted)' }}>No data in last 24h</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly}>
              <XAxis dataKey="hour" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="success" stackId="a" fill="#50e3c2" barSize={18} />
              <Bar dataKey="failure" stackId="a" fill="#ee0000" radius={[3, 3, 0, 0]} barSize={18} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#666' }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
