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
}
