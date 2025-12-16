import pino, { LoggerOptions } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  redact: {
    paths: ['email', 'password', 'passwordHash', 'token', 'smsPhone', '*.email', '*.password'],
    censor: '[REDACTED]',
  },
};

const devOptions: LoggerOptions = {
  ...baseOptions,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
};

export const logger = pino(isDevelopment ? devOptions : baseOptions);

export type Logger = typeof logger;
