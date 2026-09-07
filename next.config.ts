import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @whiskeysockets/baileys (ESM-only, loaded via dynamic import) and
  // exceljs/qrcode pull in Node built-ins at runtime. Bundling any of them
  // breaks their dynamic requires, so keep them as plain server-side
  // node_modules imports.
  serverExternalPackages: ['@whiskeysockets/baileys', 'exceljs', 'qrcode'],
  // The upload route accepts one invitation image/video up to 64 MB. Because
  // this app uses middleware for authentication, Next must also retain that
  // full request body before the route handler can parse the multipart form.
  experimental: {
    middlewareClientMaxBodySize: '64mb',
  },
};

export default nextConfig;
