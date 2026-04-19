import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';
import { createJobSchema } from '../validators/job.validator';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import * as jobService from '../../services/job.service';
import { JobStatus, JobType } from '../../models/job.model';

const router = Router();
router.use(authMiddleware);

router.post('/', rateLimitMiddleware, validate(createJobSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const job = await jobService.createJob(req.tenant!._id.toString(), req.body);
    res.status(201).json(job);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ error: 'Duplicate job' });
      return;
    }
    throw err;
  }
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, type, limit, offset } = req.query;

  const result = await jobService.listJobs(req.tenant!._id.toString(), {
    status: status as JobStatus | undefined,
    type: type as JobType | undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  });

  res.json(result);
}));

router.get('/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const job = await jobService.getJobById(req.params.id, req.tenant!._id.toString());
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
  res.json(job);
}));

router.get('/:id/executions', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const executions = await jobService.getJobExecutions(req.params.id);
  res.json(executions);
}));

router.delete('/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const deleted = await jobService.deleteJob(req.params.id, req.tenant!._id.toString());
  if (!deleted) { res.status(404).json({ error: 'Job not found or not deletable' }); return; }
  res.status(204).send();
}));

export default router;
