import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

type EventHandler = (socket: Socket, data: any) => any | Promise<any>;

export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private server: Server | null = null;

  /**
   * Attach to the Node.js HTTP server. Call once in main.ts before app.listen().
   * Socket.IO binds to the same port — no separate server needed.
   */
  initialize(httpServer: any): void {
    if (this.server) {
      this.logger.warn("SocketService already initialized — skipping.");
      return;
    }
    this.server = new Server(httpServer, {
      cors: { origin: true, credentials: false },
    });
    this.logger.log("Socket.IO server initialized.");
  }

  /** Raw server — use only when you need advanced Socket.IO APIs directly. */
  getServer(): Server {
    if (!this.server) throw new Error("SocketService not initialized.");
    return this.server;
  }

  /**
   * Register a connection lifecycle hook.
   * Called once per connected socket — use `socket.on('disconnect', ...)` inside for teardown.
   */
  onConnection(handler: (socket: Socket) => void): void {
    this.getServer().on("connection", handler);
  }

  /**
   * Register an event handler for all connections.
   * Handler return value is forwarded as a Socket.IO ack when the client provides one.
   */
  on(event: string, handler: EventHandler): void {
    this.getServer().on("connection", (socket) => {
      socket.on(event, async (data, ack) => {
        const result = await handler(socket, data);
        if (typeof ack === "function") ack(result);
      });
    });
  }

  /** Broadcast to every connected client. */
  emit(event: string, payload: unknown): void {
    if (!this.isReady(event)) return;
    this.server!.emit(event, payload);
  }

  /** Emit to all clients in a room. */
  emitToRoom(room: string, event: string, payload: unknown): void {
    if (!this.isReady(event)) return;
    this.server!.to(room).emit(event, payload);
  }

  /** True if at least one socket currently has this room joined. */
  roomHasClients(room: string): boolean {
    if (!this.server) return false;
    const members = this.server.sockets.adapter.rooms.get(room);
    return !!members && members.size > 0;
  }

  private isReady(event: string): boolean {
    if (this.server) return true;
    this.logger.warn(`Dropped "${event}" — Socket.IO not initialized.`);
    return false;
  }
}

export const socketService = new SocketService();
