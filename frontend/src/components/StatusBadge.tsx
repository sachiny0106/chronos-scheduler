const dots: Record<string, string> = {
  PENDING:     'var(--text-muted)',
  SCHEDULED:   'var(--accent)',
  QUEUED:      'var(--yellow)',
  RUNNING:     'var(--cyan)',
  COMPLETED:   'var(--green)',
  FAILED:      'var(--red)',
  RETRYING:    'var(--orange)',
  DEAD_LETTER: 'var(--red)',
};

export function StatusBadge({ status }: { status: string }) {
  const color = dots[status] || 'var(--text-muted)';
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
      <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, background: color }} />
      {status === 'DEAD_LETTER' ? 'Dead Letter' : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
