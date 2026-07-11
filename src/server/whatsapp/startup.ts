import { initializeWhatsapp } from './client';

export async function initWhatsapp(): Promise<void> {
  try {
    await initializeWhatsapp();
  } catch (err) {
    console.error(
      '[WhatsApp] Startup error occurred but the main application will continue running:',
      err
    );
  }
}
