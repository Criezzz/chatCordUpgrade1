import { Worker } from 'bullmq';
import messageService from '../services/messageService.js';

let messageWorker = new Worker('save_queue', async (job) => {
  let { room, message } = job.data;
  
  try {
    await messageService.saveMessage(room, message);
    
    return { success: true };
  } catch (error) {
    console.error(`[Consumer] Error processing message:`, error.message);
    throw error; // Retry
  }
}, { 
  concurrency: 100, 
  connection: { host: '127.0.0.1', port: 6379 } 
});

messageWorker.on('failed', (job, error) => {
  console.error(`[Consumer] Job ${job.id} failed:`, error.message);
});

console.log('[Consumer] Message consumer initialized');