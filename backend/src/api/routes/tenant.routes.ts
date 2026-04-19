import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';
import { createTenantSchema } from '../validators/tenant.validator';
import * as tenantService from '../../services/tenant.service';

const router = Router();

// POST /tenants — returns full object including apiKey (only time it's shown)
router.post('/', validate(createTenantSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json(tenant);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ error: 'Tenant name already exists' });
      return;
    }
    throw err;
  }
}));

// GET /tenants — list tenants (apiKey included for dashboard bootstrap)
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const tenants = await tenantService.listTenants();
  res.json(tenants);
}));

export default router;
