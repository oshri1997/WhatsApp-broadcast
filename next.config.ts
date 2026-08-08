import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // whatsapp-web.js drives a real Chromium through puppeteer and exceljs/qrcode
  // pull in Node built-ins at runtime. Bundling any of them breaks their
  // dynamic requires, so keep them as plain server-side node_modules imports.
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'puppeteer-core', 'exceljs', 'qrcode'],
};

export default nextConfig;
