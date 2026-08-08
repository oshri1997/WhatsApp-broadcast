export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // whatsapp-web.js drives a real browser under the hood; transient
  // navigation/network hiccups there can surface as unhandled rejections
  // instead of going through our own promise chains. Log them instead of
  // letting them kill the whole server.
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });

  // A bare Ctrl+C (or any SIGTERM) kills node before Chromium gets a chance to
  // close, which can leave a WhatsApp account's profile mid-write - corrupting
  // the very login keys LocalAuth is supposed to restore on the next launch,
  // forcing an unnecessary QR re-scan. Close every browser first.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received - closing WhatsApp sessions...`);

    const { shutdownAll } = await import('./lib/server/accounts');
    // Don't let a hung Chromium hold the process open forever.
    const timeout = new Promise((resolve) => setTimeout(resolve, 8000));
    await Promise.race([shutdownAll(), timeout]);

    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
