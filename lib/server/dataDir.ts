import path from 'node:path';

// Railway mounts persistent storage at /data. Locally, keep using the
// repository's ignored data directory so development needs no environment setup.
export const DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), 'data');
