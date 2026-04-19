import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IExecutionLog extends Document {
  jobId: Types.ObjectId;
  executionId: string;
  workerId: string;
  status: 'SUCCESS' | 'FAILURE';
  startedAt: Date;
  finishedAt: Date;
  duration: number;
  error?: { message: string; stack?: string };
  result?: Record<string, any>;
}

const errorSchema = new Schema(
  { message: { type: String, required: true }, stack: String },
  { _id: false }
);

const executionLogSchema = new Schema<IExecutionLog>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    executionId: { type: String, required: true, unique: true },
    workerId: { type: String, required: true },
    status: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    duration: { type: Number, required: true },
    error: { type: errorSchema, default: undefined },
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

executionLogSchema.index({ jobId: 1, startedAt: -1 });

export const ExecutionLog = mongoose.model<IExecutionLog>('ExecutionLog', executionLogSchema);
