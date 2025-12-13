import { Worker } from 'bullmq';
import messageService from '../services/messageService.js';
import sharedConnection from '../configs/bullmq-redis.js';

let lastDrainedLog = 0;

let messageWorker = new Worker('save_queue', async (job) => {
  let { room, message } = job.data;
  if (message.text.startsWith('test ') && Number(message.text.split(' ')[1]) % 10000 === 0) {
    console.log(`reach ${message.text.split(' ')[1]}`);
  }
  try {
    await messageService.saveMessage(room, message);
    
  } catch (error) {
    console.error(`[Consumer] Error processing message:`, error.message);
    throw error; // Retry
  }
}, { 
  concurrency: 10, 
  connection: sharedConnection
});

messageWorker.on('completed', (job) => {
  return;
});

messageWorker.on('failed', (job, error) => {
    console.error(`[Consumer] Job ${job.id} failed:`, error.message);
  });

  messageWorker.on('error', (error) => {
    console.error('[Consumer] Worker error:', error.message);
  });

  messageWorker.on('drained', () => {
    const now = Date.now();
    if (now - lastDrainedLog > 60_000) {
      console.log('[Consumer] Queue is empty');
      lastDrainedLog = now;
    }
  });

  messageWorker.on('stalled', (jobId) => {
    console.warn(`[Consumer] Job ${jobId} stalled and will be retried`);
  });

  messageWorker.on('closing', () => {
    console.log('[Consumer] Worker is shutting down');
  });

  messageWorker.on('lockRenewalFailed', (job) => {
    console.error(`[Consumer] Lock renewal failed for job ${job.id}`);
  });

  messageWorker.on('closed', () => {
    console.log('[Consumer] Worker has been closed');
  });

  messageWorker.on('paused', () => {
    console.log('[Consumer] Worker has been paused');
  });

// Graceful shutdown on SIGTERM (for Cloud Run / worker pools)
process.on('SIGTERM', async () => {
  try {
    console.log('[Worker] SIGTERM received, closing worker...');
    await messageWorker.close();
    console.log('[Worker] Worker closed, exiting process.');
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err?.message || err);
  } finally {
    process.exit(0);
  }
});

console.log('[Consumer] Message consumer initialized');