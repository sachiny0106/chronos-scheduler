import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  apiKey: string;
  rateLimit: { maxJobsPerMinute: number };
  webhookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

function generateApiKey(): string {
  return `ck_${crypto.randomBytes(24).toString('hex')}`;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, unique: true },
    apiKey: { type: String, required: true, unique: true, default: generateApiKey },
    rateLimit: {
      maxJobsPerMinute: { type: Number, default: 100 },
    },
    webhookUrl: { type: String },
  },
  { timestamps: true }
);

export const Tenant = mongoose.model<ITenant>('Tenant', tenantSchema);
