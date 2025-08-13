/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { config } from 'dotenv';
import { registerAs } from '@nestjs/config';

const env = process.env.NODE_ENV || 'dev';

const envs = {
  dev: '.env.dev',
  e2e: '.env.e2e',
};

const options = {
  path: '.env',
};

if (envs[env]) {
  options.path = envs[env];
}

config({
  path: options.path,
});

export default registerAs('config', () => {
  return {
    supabase: {
      url: process.env.NEON_URL,
    },
    apikey: process.env.API_KEY,
  };
});

export const apiRoute = process.env.API_ROUTE;
