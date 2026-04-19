import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export interface JobEvent {
  jobId: string;
  tenantId: string;
  from: string;
  to: string;
  timestamp: string;
  workerId?: string;
}

export function useJobEvents(limit = 50) {
  const [events, setEvents] = useState<JobEvent[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const handler = (event: JobEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, limit));
    };

    socket.on('job:update', handler);
    return () => { socket.off('job:update', handler); };
  }, [limit]);

  return events;
}
