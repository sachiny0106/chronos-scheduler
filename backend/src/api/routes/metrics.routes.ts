import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { authMiddleware } from '../middleware/auth';
import { Job, JobStatus } from '../../models/job.model';
import { ExecutionLog } from '../../models/execution-log.model';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenant!._id;

  const [statusCounts, recentExecutions, avgDuration, throughput] = await Promise.all([
    // Job counts by status
    Job.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Last 50 executions for success/failure timeline
    ExecutionLog.aggregate([
      { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
      { $match: { 'job.tenantId': tenantId } },
      { $sort: { finishedAt: -1 } },
      { $limit: 50 },
      { $project: { status: 1, duration: 1, finishedAt: 1, workerId: 1 } },
    ]),

    // Avg execution duration by status
    ExecutionLog.aggregate([
      { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
      { $match: { 'job.tenantId': tenantId } },
      { $group: {
        _id: '$status',
        avgDuration: { $avg: '$duration' },
        count: { $sum: 1 },
      }},
    ]),

    // Hourly throughput (last 24h)
    ExecutionLog.aggregate([
      { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
      { $match: {
        'job.tenantId': tenantId,
        finishedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }},
      { $group: {
        _id: {
          hour: { $hour: '$finishedAt' },
          status: '$status',
        },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.hour': 1 } },
    ]),
  ]);

  // Build status map
  const statuses: Record<string, number> = {};
  for (const s of statusCounts) {
    statuses[s._id] = s.count;
  }

  const total = Object.values(statuses).reduce((a, b) => a + b, 0);

  res.json({
    jobs: { total, ...statuses },
    executions: {
      recent: recentExecutions,
      avgDuration: avgDuration.reduce((acc: any, d: any) => {
        acc[d._id] = { avg: Math.round(d.avgDuration), count: d.count };
        return acc;
      }, {}),
    },
    throughput,
  });
}));

export default router;
