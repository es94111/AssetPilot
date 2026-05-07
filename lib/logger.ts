import pino from 'pino';

// pino-pretty transport uses worker_threads which can't resolve module paths
// inside Next.js webpack RSC context — use plain JSON output instead
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export default logger;
