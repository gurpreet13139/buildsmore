/**
 * BUILDsmore — Redis & BullMQ Asynchronous Job Pipeline
 * Handles background property synchronization, scheduled WordPress crawls, and caching.
 */

import Redis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import { getServerConfig } from './config';

let redisClientInstance: Redis | null = null;
let importQueueInstance: Queue | null = null;

export function getRedisClient(): Redis {
  if (!redisClientInstance) {
    const config = getServerConfig();
    redisClientInstance = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null; // do not reconnect indefinitely in local test environments
        return Math.min(times * 200, 2000);
      },
    });

    redisClientInstance.on('error', (err) => {
      // Quiet log for server resiliency
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Redis] Connection notification:', err.message);
      }
    });
  }
  return redisClientInstance;
}

export function getImportQueue(): Queue {
  if (!importQueueInstance) {
    const redis = getRedisClient();
    importQueueInstance = new Queue('wordpress-property-imports', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return importQueueInstance;
}

/**
 * Registers background worker for asynchronous import jobs
 */
export function registerImportWorker(
  processor: (job: Job) => Promise<unknown>
): Worker {
  const redis = getRedisClient();
  const worker = new Worker('wordpress-property-imports', processor, {
    connection: redis,
    concurrency: 4,
  });

  worker.on('completed', (job: Job) => {
    console.log(`[BullMQ] Import Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[BullMQ] Import Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Validates Redis connectivity
 */
export async function testRedisConnectivity(): Promise<{ connected: boolean; message: string }> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pong = await redis.ping();
    return { connected: pong === 'PONG', message: `Redis responded with ${pong}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { connected: false, message: `Redis connection notice: ${msg}` };
  }
}
