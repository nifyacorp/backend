import pino from 'pino';
import { getConfig } from '../config/index.js';

const defaultLogger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  serializers: {
    error: pino.stdSerializers.err,
  },
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
