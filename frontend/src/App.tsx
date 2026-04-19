import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { CreateJobPage } from './pages/CreateJobPage';
import { LiveFeedPage } from './pages/LiveFeedPage';
import { DLQPage } from './pages/DLQPage';
import { MetricsPage } from './pages/MetricsPage';
import { ApiKeyGate } from './components/ApiKeyGate';

export default function App() {
  return (
    <BrowserRouter>
      <ApiKeyGate>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/create" element={<CreateJobPage />} />
            <Route path="/live" element={<LiveFeedPage />} />
            <Route path="/dlq" element={<DLQPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
          </Route>
        </Routes>
      </ApiKeyGate>
    </BrowserRouter>
  );
}
