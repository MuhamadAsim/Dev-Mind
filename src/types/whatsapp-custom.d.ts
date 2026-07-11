declare module 'whatsapp-web.js' {
  export interface Message {
    from: string;
    to: string;
    author?: string;
    body: string;
    type: string;
    reply(content: string): Promise<unknown>;
  }

  export class LocalAuth {
    constructor(options?: { clientId?: string; dataPath?: string });
  }

  export interface ClientOptions {
    authStrategy?: unknown;
    puppeteer?: {
      args?: string[];
      headless?: boolean;
      executablePath?: string;
    };
  }

  export class Client {
    constructor(options: ClientOptions);
    on(event: 'qr', callback: (qr: string) => void): void;
    on(event: 'authenticated', callback: () => void): void;
    on(event: 'auth_failure', callback: (message: string) => void): void;
    on(event: 'ready', callback: () => void): void;
    on(event: 'message', callback: (message: Message) => void): void;
    on(event: 'message_create', callback: (message: Message) => void): void;
    on(event: 'disconnected', callback: (reason: string) => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    initialize(): Promise<void>;
    sendMessage(chatId: string, content: string, options?: unknown): Promise<unknown>;
  }
}

declare module 'qrcode-terminal' {
  export function generate(qr: string, options?: { small: boolean }): void;
}
