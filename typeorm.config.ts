import { config } from 'dotenv';
import { DataSource } from 'typeorm';

const env = process.env.NODE_ENV || 'dev';

config({
  path: `.env.${env}`,
});

export default new DataSource({
  type: 'postgres',
  url: process.env.NEON_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
