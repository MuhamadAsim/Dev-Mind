import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleIncomingMessage } from './messageHandler';
import fs from 'fs';

function findChromePath(): string | undefined {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

interface WhatsappCache {
  client: Client | null;
  isInitializing: boolean;
}

const globalWithCache = global as typeof global & { _whatsappCache?: WhatsappCache };
if (!globalWithCache._whatsappCache) {
  globalWithCache._whatsappCache = { client: null, isInitializing: false };
}
const cache = globalWithCache._whatsappCache;

export function getWhatsappClient(): Client {
  if (cache.client) {
    return cache.client;
  }

  console.log('[WhatsApp] Creating new client instance...');

  const execPath = findChromePath();
  if (execPath) {
    console.log(`[WhatsApp] Found local browser executable at: ${execPath}`);
  } else {
    console.warn(
      '[WhatsApp] WARNING: Could not find Chrome/Edge on standard paths. Puppeteer will fall back to default behavior.'
    );
  }

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
      ...(execPath ? { executablePath: execPath } : {}),
    },
  });

  // Listeners
  client.on('qr', (qr) => {
    console.log('[WhatsApp] QR Generated. Please scan:');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated successfully');
  });

  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Authentication failure:', msg);
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Connected and ready!');
  });

  client.on('disconnected', (reason) => {
    console.log('[WhatsApp] Client disconnected:', reason);
  });

  client.on('message', async (message) => {
    try {
      await handleIncomingMessage(message);
    } catch (err) {
      console.error('[WhatsApp] Error in message handler:', err);
    }
  });

  cache.client = client;
  return client;
}

export async function initializeWhatsapp(): Promise<void> {
  if (cache.client && cache.isInitializing) {
    console.log('[WhatsApp] Client already initialized or initializing.');
    return;
  }

  const client = getWhatsappClient();
  cache.isInitializing = true;
  try {
    console.log('[WhatsApp] Initializing client...');
    await client.initialize();
  } catch (err) {
    console.error('[WhatsApp] Failed to initialize client:', err);
    cache.isInitializing = false;
    throw err;
  }
}
