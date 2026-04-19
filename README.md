# Chronos Scheduler

Distributed task scheduler with a REST API, real-time dashboard, and fault-tolerant job execution. Built with Node.js, TypeScript, Redis, MongoDB, and React.

## Architecture

```
Client / Dashboard
       │
       ▼
┌─────────────┐     ┌──────────────────────────────────────────┐
│  REST API   │────▶│                 Redis                     │
│  + Socket.io│     │  Sorted Set   Stream        Leader Lock   │
│  (Express)  │     │  (due_jobs)   (job_queue)   (SET NX PX)  │
└─────────────┘     └──────┬──────────────┬────────────────────┘
                           │              │
                           ▼              ▼
                    ┌────────────┐  ┌───────────┐
                    │  Scheduler │  │  Workers   │  ← N instances
                    │  (leader)  │  │  (pool)    │
                    │            │  │            │
                    │  Poll set  │  │  XREADGROUP│
                    │  Enqueue   │  │  Execute   │
                    │  Reaper    │  │  Heartbeat │
                    └────────────┘  └───────────┘
                           │              │
                           ▼              ▼
                    ┌──────────────────────────┐
                    │        MongoDB            │
                    │  Jobs  Executions Tenants │
                    └──────────────────────────┘
```

## System Design Concepts

| Concept | Implementation |
|---------|---------------|
| State Machine | Atomic `findOneAndUpdate` with status precondition |
| Leader Election | Redis `SET NX PX` + Lua CAS renewal (no split-brain) |
| Consumer Groups | Redis Streams `XREADGROUP` with PEL recovery |
| At-Least-Once | ACK after execution, pending message recovery on crash |
| Idempotency | Redis `SET NX EX` dedup on job creation |
| Heartbeat + Reaper | Workers heartbeat every 5s, leader reaps stale jobs |
| Exponential Backoff | `5s * 2^n` with jitter, capped at 5min |
| Dead Letter Queue | Jobs quarantined after max retries, manual retry via API |
| Multi-tenancy | API key auth, per-tenant isolation |
| Real-time Events | Redis Pub/Sub bridged to Socket.io for dashboard |

## Job Lifecycle

```
PENDING → SCHEDULED → QUEUED → RUNNING → COMPLETED
                                  │
                                  ▼
                                FAILED → RETRYING → SCHEDULED (back to sorted set)
                                  │
                                  ▼ (max retries)
                              DEAD_LETTER → PENDING (manual retry)
```

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (for MongoDB + Redis)

### 1. Start Infrastructure

```bash
docker compose up -d
```

### 2. Install Dependencies

```bash
npm run install:all
# or manually:
cd backend && npm install && cd ../frontend && npm install
```

### 3. Run Everything (4 terminals)

```bash
npm run dev:api          # API + WebSocket   → http://localhost:3000
npm run dev:scheduler    # Scheduler (leader election)
npm run dev:worker       # Worker pool
npm run dev:frontend     # React dashboard   → http://localhost:5173
```

### 4. Open Dashboard

Go to `http://localhost:5173` — select or create a tenant, then start creating jobs.

### 5. Or Use the API Directly

```bash
# Create tenant
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project"}'

# Create job (use the API key from tenant response)
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "name": "demo:process",
    "type": "one-time",
    "payload": {"message": "Hello Chronos!"},
    "runAt": "2025-01-01T00:00:00Z",
    "priority": 8
  }'
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tenants` | Create a tenant |
| `GET` | `/tenants` | List tenants |
| `POST` | `/jobs` | Create a job |
| `GET` | `/jobs` | List jobs (filterable by status, type) |
| `GET` | `/jobs/:id` | Get job details |
| `GET` | `/jobs/:id/executions` | Execution history |
| `DELETE` | `/jobs/:id` | Cancel a pending/scheduled job |
| `GET` | `/dlq` | List dead-letter jobs |
| `POST` | `/dlq/:id/retry` | Re-enqueue a DLQ job |
| `GET` | `/metrics` | Job stats, throughput, durations |
| `GET` | `/health` | Health check |

## Dashboard

React-based monitoring dashboard with 6 views:

- **Dashboard** — Status cards, live event stream
- **Jobs** — Filterable job table with pagination
- **Job Detail** — Payload, execution history, retry info
- **Create Job** — Form with handler selection, cron, payload editor
- **Live Feed** — Real-time WebSocket event stream
- **Dead Letter** — Failed jobs with retry buttons
- **Metrics** — Status distribution pie chart, throughput bar chart, duration stats

## Testing

```bash
npm test                 # Unit tests (26 tests) — runs in backend/
npm run load-test        # Submit 100 jobs, track throughput
npm run chaos-test       # Test retry, DLQ, idempotency
```

## Multi-Instance Demo

```bash
docker compose -f docker-compose.demo.yml up --build
# Starts: 2 API servers, 2 schedulers (leader + standby), 3 workers
```

## Project Structure

```
chronos-scheduler/
├── backend/                        # Node.js server
│   ├── src/
│   │   ├── index.ts                # API server entry point
│   │   ├── scheduler.ts            # Scheduler entry point
│   │   ├── worker.ts               # Worker entry point
│   │   ├── config/                 # Environment config
│   │   ├── models/                 # Mongoose schemas
│   │   ├── api/                    # Express routes, middleware, validators
│   │   ├── core/                   # Distributed systems logic
│   │   │   ├── state-machine.ts    # Atomic state transitions
│   │   │   ├── leader-election.ts  # Redis leader lease (Lua CAS)
│   │   │   ├── scheduler-loop.ts   # Due-job polling
│   │   │   ├── worker-pool.ts      # Redis Streams consumer
│   │   │   ├── heartbeat.ts        # Worker liveness
│   │   │   ├── reaper.ts           # Stale job detection
│   │   │   ├── retry-strategy.ts   # Backoff + DLQ routing
│   │   │   ├── idempotency.ts      # Redis dedup
│   │   │   └── cron-expander.ts    # Cron scheduling
│   │   ├── services/               # Business logic
│   │   ├── handlers/               # Pluggable job handlers
│   │   └── lib/                    # Redis, MongoDB, logger
│   ├── tests/unit/                 # Vitest unit tests
│   ├── scripts/                    # Seed, load test, chaos test
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                       # React dashboard
│   ├── src/
│   │   ├── pages/                  # 7 page components
│   │   ├── components/             # Layout, Sidebar, StatusBadge
│   │   ├── hooks/                  # useJobEvents (WebSocket)
│   │   └── lib/                    # API client, Socket.io
│   ├── vite.config.ts              # Dev proxy to backend API
│   └── package.json
│
├── docker-compose.yml              # Dev: MongoDB + Redis
├── docker-compose.demo.yml         # Demo: full multi-instance
├── package.json                    # Root scripts (convenience)
└── README.md
```

## Tech Stack

**Backend:** Node.js, TypeScript, Express, MongoDB (Mongoose), Redis (ioredis), Socket.io, Zod, Pino

**Frontend:** React, TypeScript, Tailwind CSS, Recharts, Socket.io Client, React Router, Lucide Icons

**Infra:** Docker, Docker Compose

## License

MIT
