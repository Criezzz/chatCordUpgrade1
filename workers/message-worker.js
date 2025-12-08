import { Worker } from 'bullmq';
import messageService from '../services/messageService.js';

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
  concurrency: 100, 
  connection: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) } 
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
    console.log('[Consumer] All messages have been processed');
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

console.log('[Consumer] Message consumer initialized');