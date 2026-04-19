import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
