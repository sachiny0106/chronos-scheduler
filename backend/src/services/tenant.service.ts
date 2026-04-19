import { Tenant, ITenant } from '../models/tenant.model';
import { CreateTenantInput } from '../api/validators/tenant.validator';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('tenant-service');

export async function createTenant(input: CreateTenantInput): Promise<ITenant> {
  const tenant = await Tenant.create(input);
  log.info({ tenantId: tenant._id, name: tenant.name }, 'Tenant created');
  return tenant;
}

export async function getTenantById(tenantId: string): Promise<ITenant | null> {
  return Tenant.findById(tenantId);
}

export async function listTenants(): Promise<ITenant[]> {
  return Tenant.find().sort({ createdAt: -1 });
}
