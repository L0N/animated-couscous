/**
 * Start Worker Script - Background Job Processing for WanPaus v4.0
 * 
 * Starts the background job worker for processing automated system tasks.
 * Handles graceful shutdown and process management.
 * 
 * Usage:
 * - npm run worker:start
 * - tsx scripts/startWorker.ts
 */

import mongoose from 'mongoose';
import { jobWorkerService } from '@/services/jobWorkerService';

async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

async function main(): Promise<void> {
  try {
    console.log('🚀 WanPaus v4.0 Job Worker');
    console.log('==========================');

    // Connect to database
    await connectDatabase();

    // Start job worker
    await jobWorkerService.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await jobWorkerService.stop();
      await mongoose.disconnect();
      console.log('👋 Worker stopped');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await jobWorkerService.stop();
      await mongoose.disconnect();
      console.log('👋 Worker stopped');
      process.exit(0);
    });

    // Keep process alive
    console.log('✅ Worker is running. Press Ctrl+C to stop.');

  } catch (error) {
    console.error('❌ Worker failed to start:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as startWorker };
