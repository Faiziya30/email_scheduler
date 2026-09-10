import { ConnectionOptions } from 'bullmq';
import { env } from './env';

const url = new URL(env.REDIS_URL);

export const redisConnectionOptions: ConnectionOptions = {
  host: url.hostname || 'localhost',
  port: parseInt(url.port || '6379', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
