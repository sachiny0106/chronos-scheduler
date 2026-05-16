const colors: Record<string, { bg: string, text: string, dot: string }> = {
  PENDING:     { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', dot: '#9ca3af' },
  SCHEDULED:   { bg: 'rgba(99, 102, 241, 0.15)',  text: '#818cf8', dot: '#6366f1' },
  QUEUED:      { bg: 'rgba(245, 158, 11, 0.15)',  text: '#fbbf24', dot: '#f59e0b' },
  RUNNING:     { bg: 'rgba(6, 182, 212, 0.15)',   text: '#22d3ee', dot: '#06b6d4' },
  COMPLETED:   { bg: 'rgba(16, 185, 129, 0.15)',  text: '#34d399', dot: '#10b981' },
  FAILED:      { bg: 'rgba(239, 68, 68, 0.15)',   text: '#f87171', dot: '#ef4444' },
  RETRYING:    { bg: 'rgba(249, 115, 22, 0.15)',  text: '#fb923c', dot: '#f97316' },
  DEAD_LETTER: { bg: 'rgba(239, 68, 68, 0.15)',   text: '#f87171', dot: '#ef4444' },
};

export function StatusBadge({ status }: { status: string }) {
  const theme = colors[status] || colors.PENDING;
  
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide whitespace-nowrap border"
      style={{ 
        backgroundColor: theme.bg, 
        color: theme.text,
        borderColor: theme.bg.replace('0.15', '0.3')
      }}
    >
      <span 
        className={`shrink-0 rounded-full ${status === 'RUNNING' ? 'animate-pulse' : ''}`} 
        style={{ width: 6, height: 6, background: theme.dot, boxShadow: `0 0 6px ${theme.dot}` }} 
      />
      {status === 'DEAD_LETTER' ? 'Dead Letter' : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
