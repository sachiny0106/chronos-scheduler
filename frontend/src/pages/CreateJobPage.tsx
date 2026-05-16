import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob } from '../lib/api';
import { PlusCircle, Loader2 } from 'lucide-react';

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
      try { payload = JSON.parse(f.payload); } catch { setErr('Invalid JSON in Payload'); setBusy(false); return; }
      const body: any = { ...f, payload, runAt: new Date(f.runAt).toISOString() };
      if (f.type !== 'cron') delete body.cronExpression;
      if (!f.idempotencyKey) delete body.idempotencyKey;
      const job = await createJob(body);
      nav(`/jobs/${job._id}`);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Create Job</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configure and enqueue a new task into the system</p>
      </div>

      <div className="glass-card p-6 md:p-8">
        {err && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            {err}
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Lbl text="Task Handler">
              <select value={f.name} onChange={set('name')}>
                <option value="demo:process">demo:process</option>
                <option value="demo:echo">demo:echo</option>
                <option value="demo:always-fail">demo:always-fail</option>
              </select>
            </Lbl>

            <Lbl text="Execution Type">
              <select value={f.type} onChange={set('type')}>
                <option value="one-time">One-time Execution</option>
                <option value="delayed">Delayed / Scheduled</option>
                <option value="cron">Recurring (Cron)</option>
              </select>
            </Lbl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {f.type === 'cron' ? (
              <Lbl text="Cron Expression">
                <input value={f.cronExpression} onChange={set('cronExpression')} placeholder="*/5 * * * *" className="font-mono" />
              </Lbl>
            ) : (
              <Lbl text="Run At (Local Time)">
                <input type="datetime-local" value={f.runAt} onChange={set('runAt')} />
              </Lbl>
            )}

            <Lbl text="Idempotency Key (Optional)">
              <input value={f.idempotencyKey} onChange={set('idempotencyKey')} placeholder="e.g. order-123-process" />
            </Lbl>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wider mb-4 text-gray-500">Advanced Settings</p>
            <div className="grid grid-cols-3 gap-4">
              <Lbl text="Priority (1-10)">
                <input type="number" min={1} max={10} value={f.priority} onChange={set('priority')} className="text-center" />
              </Lbl>
              <Lbl text="Max Retries">
                <input type="number" min={0} max={20} value={f.maxRetries} onChange={set('maxRetries')} className="text-center" />
              </Lbl>
              <Lbl text="Timeout (ms)">
                <input type="number" min={1000} value={f.timeout} onChange={set('timeout')} className="text-center tabular-nums" />
              </Lbl>
            </div>
          </div>

          <Lbl text="JSON Payload">
            <textarea 
              value={f.payload} 
              onChange={set('payload')} 
              rows={4} 
              className="font-mono text-[13px] resize-y" 
              spellCheck={false}
            />
          </Lbl>

          <button
            type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[14px] font-semibold text-white disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
            {busy ? 'Enqueuing Job...' : 'Create & Enqueue Job'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Lbl({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block w-full">
      <span className="text-[13px] font-medium tracking-wide mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>{text}</span>
      {children}
    </label>
  );
}
