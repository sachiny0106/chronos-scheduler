const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const apiKey = localStorage.getItem('chronos_api_key');
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...init?.headers } });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

// Tenants
export const createTenant = (name: string) =>
  request<any>('/tenants', { method: 'POST', body: JSON.stringify({ name }) });

export const listTenants = () => request<any[]>('/tenants');

// Jobs
export const createJob = (data: any) =>
  request<any>('/jobs', { method: 'POST', body: JSON.stringify(data) });

export const listJobs = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<{ jobs: any[]; total: number }>(`/jobs${qs}`);
};

export const getJob = (id: string) => request<any>(`/jobs/${id}`);

export const getJobExecutions = (id: string) => request<any[]>(`/jobs/${id}/executions`);

export const deleteJob = (id: string) =>
  request<void>(`/jobs/${id}`, { method: 'DELETE' });

// DLQ
export const listDLQ = () => request<any[]>('/dlq');
export const retryDLQ = (id: string) => request<any>(`/dlq/${id}/retry`, { method: 'POST' });

// Metrics
export const getMetrics = () => request<any>('/metrics');
