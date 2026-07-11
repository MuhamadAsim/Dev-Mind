export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[DevMind Startup] Initializing server instrumentation...');
    try {
      const { initWhatsapp } = await import('@/server/whatsapp/startup');
      initWhatsapp().catch((err) => {
        console.error('[DevMind Startup] WhatsApp startup async error:', err);
      });
    } catch (err) {
      console.error('[DevMind Startup] Failed to dynamically load WhatsApp module:', err);
    }
  }
}
