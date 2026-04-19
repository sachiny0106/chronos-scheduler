import mongoose from 'mongoose';
import { config } from '../src/config';
import { Tenant } from '../src/models/tenant.model';

async function seed() {
  await mongoose.connect(config.mongo.uri);

  const existing = await Tenant.findOne({ name: 'demo-tenant' });
  if (existing) {
    console.log('Demo tenant already exists:');
    console.log(`  Name:    ${existing.name}`);
    console.log(`  API Key: ${existing.apiKey}`);
    console.log(`  ID:      ${existing._id}`);
    await mongoose.disconnect();
    return;
  }

  const tenant = await Tenant.create({
    name: 'demo-tenant',
    rateLimit: { maxJobsPerMinute: 200 },
  });

  console.log('Demo tenant created:');
  console.log(`  Name:    ${tenant.name}`);
  console.log(`  API Key: ${tenant.apiKey}`);
  console.log(`  ID:      ${tenant._id}`);
  console.log('\nUse this API key in the x-api-key header for all job operations.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
