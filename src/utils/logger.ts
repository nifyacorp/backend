import pkg from 'pino';

const pino = pkg as unknown as typeof pkg;

const logger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  serializers: {
    error: pkg.stdSerializers.err,
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

export default logger;
