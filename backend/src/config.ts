import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'production',
  port: Number(process.env.SERVER_PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://zora:zora@db:5432/zora?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  currency: process.env.CURRENCY || 'COP',
  printerHost: process.env.PRINTER_HOST,
  printerPort: Number(process.env.PRINTER_PORT || 9100),
} as const;


