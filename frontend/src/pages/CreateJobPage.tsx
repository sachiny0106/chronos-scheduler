import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob } from '../lib/api';

export function CreateJobPage() {
  const nav = useNavigate();
  const [f, setF] = useState({
    name: 'demo:process', type: 'one-time',
    payload: '{"message": "Hello Chronos!"}',
    runAt: new Date(Date.now() + 5000).toISOString().slice(0, 16),
    priority: 5, maxRetries: 3, retryBackoff: 'exponential',
    timeout: 30000, cronExpression: '', idempotencyKey: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setF(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      let payload: any;
      try { payload = JSON.parse(f.payload); } catch { setErr('Invalid JSON'); setBusy(false); return; }
      const body: any = { ...f, payload, runAt: new Date(f.runAt).toISOString() };
      if (f.type !== 'cron') delete body.cronExpression;
      if (!f.idempotencyKey) delete body.idempotencyKey;
      const job = await createJob(body);
      nav(`/jobs/${job._id}`);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="max-w-md space-y-4">
      <p className="text-[14px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>New Job</p>

      {err && <p className="text-[12px]" style={{ color: 'var(--red)' }}>{err}</p>}

      <form onSubmit={submit} className="space-y-3">
        <Lbl text="Handler">
          <select value={f.name} onChange={set('name')}>
            <option value="demo:process">demo:process</option>
            <option value="demo:echo">demo:echo</option>
            <option value="demo:always-fail">demo:always-fail</option>
          </select>
        </Lbl>

        <Lbl text="Type">
          <select value={f.type} onChange={set('type')}>
            <option value="one-time">One-time</option>
            <option value="delayed">Delayed</option>
            <option value="cron">Cron</option>
          </select>
        </Lbl>

        {f.type === 'cron' && (
          <Lbl text="Cron Expression">
            <input value={f.cronExpression} onChange={set('cronExpression')} placeholder="*/5 * * * *" />
          </Lbl>
        )}

        <Lbl text="Run At">
          <input type="datetime-local" value={f.runAt} onChange={set('runAt')} />
        </Lbl>

        <div className="grid grid-cols-3 gap-2">
          <Lbl text="Priority"><input type="number" min={1} max={10} value={f.priority} onChange={set('priority')} /></Lbl>
          <Lbl text="Retries"><input type="number" min={0} max={20} value={f.maxRetries} onChange={set('maxRetries')} /></Lbl>
          <Lbl text="Timeout"><input type="number" min={1000} value={f.timeout} onChange={set('timeout')} /></Lbl>
        </div>

        <Lbl text="Payload">
          <textarea value={f.payload} onChange={set('payload')} rows={3} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
        </Lbl>

        <Lbl text="Idempotency Key">
          <input value={f.idempotencyKey} onChange={set('idempotencyKey')} placeholder="optional" />
        </Lbl>

        <button
          type="submit" disabled={busy}
          className="w-full py-2 rounded-[6px] text-[13px] font-medium disabled:opacity-30 transition-opacity"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {busy ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </div>
  );
}

function Lbl({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{text}</span>
      {children}
    </label>
  );
}
