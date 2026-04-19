import { useState, useEffect } from 'react';
import { listTenants, createTenant } from '../lib/api';
import { Clock } from 'lucide-react';

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('chronos_api_key') || '');
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (apiKey) { localStorage.setItem('chronos_api_key', apiKey); setReady(true); return; }
    listTenants().then(t => { setTenants(t); setLoading(false); }).catch(() => setLoading(false));
  }, [apiKey]);

  if (ready) return <>{children}</>;

  const pick = (key: string) => { setApiKey(key); localStorage.setItem('chronos_api_key', key); };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try { const t = await createTenant(newName.trim()); pick(t.apiKey); } catch {}
    setCreating(false);
  };

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <Clock size={24} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <h1 className="text-[15px] font-medium tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Chronos</h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Select a workspace</p>
        </div>

        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
          {loading ? (
            <p className="text-center py-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>Connecting...</p>
          ) : (
            <>
              {tenants.length > 0 && (
                <div className="mb-4 space-y-1">
                  {tenants.map(t => (
                    <button
                      key={t._id}
                      onClick={() => pick(t.apiKey)}
                      className="w-full text-left px-3 py-2 rounded-[4px] transition-colors"
                      style={{ border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <span className="text-[13px]" style={{ color: 'var(--text)' }}>{t.name}</span>
                      <span className="block text-[11px] font-mono mt-px" style={{ color: 'var(--text-muted)' }}>
                        {t.apiKey.slice(0, 20)}...
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>New workspace</p>
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="project-name"
                    className="flex-1"
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="shrink-0 px-3 py-1 rounded-[4px] text-[12px] font-medium disabled:opacity-30 transition-opacity"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
