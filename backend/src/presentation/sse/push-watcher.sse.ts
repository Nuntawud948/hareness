import { FastifyReply, FastifyRequest } from 'fastify';

export interface PushWatcherEvent {
  id: string;
  platform: string;
  targetId: string;
  messageContent: string;
  status: string;
  errorMessage?: string | null;
  sourceTrigger: string;
  createdAt: Date;
}

export class PushWatcherSSEManager {
  private clients = new Set<FastifyReply>();

  constructor() {
    // Keep-alive ping every 15 seconds to prevent connection drops
    setInterval(() => {
      this.broadcast({ type: 'ping', timestamp: new Date().toISOString() });
    }, 15_000).unref();
  }

  addClient(request: FastifyRequest, reply: FastifyReply): void {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    this.clients.add(reply);

    // Send initial connected message
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE stream connected' })}\n\n`);

    request.raw.on('close', () => {
      this.clients.delete(reply);
    });
  }

  broadcast(data: any): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.raw.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  broadcastPushEvent(event: PushWatcherEvent): void {
    this.broadcast({
      type: 'push_message',
      data: event,
    });
  }
}
