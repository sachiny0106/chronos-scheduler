import mongoose, { Schema, Document, Types } from 'mongoose';

export enum JobStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  DEAD_LETTER = 'DEAD_LETTER',
}

export enum JobType {
  ONE_TIME = 'one-time',
  DELAYED = 'delayed',
  CRON = 'cron',
}

export enum RetryBackoff {
  FIXED = 'fixed',
  EXPONENTIAL = 'exponential',
}

export interface IJob extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  type: JobType;
  cronExpression?: string;
  payload: Record<string, any>;
  status: JobStatus;
  priority: number;
  runAt: Date;
  maxRetries: number;
  retryCount: number;
  retryBackoff: RetryBackoff;
  idempotencyKey?: string;
  workerId?: string;
  executionId?: string;
  lastHeartbeat?: Date;
  timeout: number;
  parentJobId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(JobType), required: true },
    cronExpression: { type: String },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.PENDING,
    },
    priority: { type: Number, default: 5, min: 1, max: 10 },
    runAt: { type: Date, required: true },
    maxRetries: { type: Number, default: 3 },
    retryCount: { type: Number, default: 0 },
    retryBackoff: { type: String, enum: Object.values(RetryBackoff), default: RetryBackoff.EXPONENTIAL },
    idempotencyKey: { type: String },
    workerId: { type: String },
    executionId: { type: String },
    lastHeartbeat: { type: Date },
    timeout: { type: Number, default: 30000 },
    parentJobId: { type: Schema.Types.ObjectId, ref: 'Job' },
  },
  { timestamps: true }
);

jobSchema.index({ tenantId: 1, status: 1 });
jobSchema.index({ status: 1, runAt: 1 });
jobSchema.index({ status: 1, lastHeartbeat: 1 });
jobSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $type: 'string' } } }
);

export const Job = mongoose.model<IJob>('Job', jobSchema);
