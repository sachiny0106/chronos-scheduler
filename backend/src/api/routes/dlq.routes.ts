import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { authMiddleware } from '../middleware/auth';
import * as jobService from '../../services/job.service';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const jobs = await jobService.listDeadLetterJobs(req.tenant!._id.toString());
  res.json(jobs);
}));

router.post('/:id/retry', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const job = await jobService.retryDeadLetterJob(req.params.id, req.tenant!._id.toString());
  if (!job) { res.status(404).json({ error: 'DLQ job not found' }); return; }
  res.json(job);
}));

export default router;
