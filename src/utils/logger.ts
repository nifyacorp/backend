import pino from 'pino';
import config from '../config/index.js';

const logger = pino({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  serializers: {
    error: pino.stdSerializers.err,
  },
  transport: config.NODE_ENV === 'development'
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

export default logger;