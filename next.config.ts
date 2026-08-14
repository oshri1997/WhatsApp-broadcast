import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @whiskeysockets/baileys (ESM-only, loaded via dynamic import) and
  // exceljs/qrcode pull in Node built-ins at runtime. Bundling any of them
  // breaks their dynamic requires, so keep them as plain server-side
  // node_modules imports.
  serverExternalPackages: ['@whiskeysockets/baileys', 'exceljs', 'qrcode'],
};

export default nextConfig;
