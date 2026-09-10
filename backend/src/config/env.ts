import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),

  JWT_SECRET: z.string().default('super_secret_jwt_key_change_in_production'),

  GOOGLE_CLIENT_ID: z.string().default('mock_google_client_id'),
  GOOGLE_CLIENT_SECRET: z.string().default('mock_google_client_secret'),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  SLACK_CLIENT_ID: z.string().default('mock_slack_client_id'),
  SLACK_CLIENT_SECRET: z.string().default('mock_slack_client_secret'),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/auth/slack/callback'),

  WORKER_CONCURRENCY: z.string().default('5').transform((val) => parseInt(val, 10)),
  MIN_DELAY_MS_BETWEEN_SENDS: z.string().default('1000').transform((val) => parseInt(val, 10)),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('100').transform((val) => parseInt(val, 10)),

  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASS: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
