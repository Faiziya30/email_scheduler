import { ConnectionOptions } from 'bullmq';
import { env } from './env';

export const normalizeRedisUrl = (value: string): string => {
  const input = value.trim().replace(/^['"]|['"]$/g, '');
  const cliMatch = input.match(/redis-cli\s+--tls\s+-u\s+(rediss?:\/\/\S+)/i);
  if (cliMatch) {
    return cliMatch[1].replace(/["'\\]+$/, '').replace(/^redis:\/\//, 'rediss://');
  }

  return input.replace(/[\r\n]+$/, '');
};

const parseRedisUrl = (redisUrl: string): ConnectionOptions => {
  try {
    const parsed = new URL(normalizeRedisUrl(redisUrl));
    const isTls = parsed.protocol === 'rediss:';

    const opts: ConnectionOptions = {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || (isTls ? '6379' : '6379'), 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryStrategy: (times: number) => Math.min(times * 250, 2000),
    };

    if (parsed.username) {
      opts.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      opts.password = decodeURIComponent(parsed.password);
    }
    if (isTls) {
      opts.tls = {
        rejectUnauthorized: false,
      };
    }

    return opts;
  } catch (error) {
    console.warn('⚠️ Could not parse REDIS_URL, falling back to localhost:6379');
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryStrategy: (times: number) => Math.min(times * 250, 2000),
    };
  }
};

export const redisConnectionOptions: ConnectionOptions = parseRedisUrl(env.REDIS_URL);

