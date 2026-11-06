import type { Context } from "grammy";

const TTL_MS = 10 * 60 * 1000;

/**
 * Estado "estoy esperando que me escribas algo" compartido por todos los flujos (nombre de categoria,
 * importe nuevo, fecha...). Solo hay una espera activa a la vez; un comando o una espera nueva la sustituye.
 */
export class InputState {
  private handler: ((ctx: Context) => Promise<void>) | null = null;
  private expires = 0;

  set(handler: (ctx: Context) => Promise<void>): void {
    this.handler = handler;
    this.expires = Date.now() + TTL_MS;
  }

  clear(): void {
    this.handler = null;
  }

  /** Pasa el texto al flujo que espera. Devuelve false si no habia nada esperando. */
  async handle(ctx: Context): Promise<boolean> {
    if (!this.handler || this.expires < Date.now()) {
      this.handler = null;
      return false;
    }
    await this.handler(ctx);
    return true;
  }
}
