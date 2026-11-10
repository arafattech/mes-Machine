import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, defer } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;
  private socketUrl = environment.SocketServer;
  private isConnecting = false;
  private hasConnected = false;
  private readonly reconnected$ = new Subject<void>();

  constructor() {
    this.socket = io(this.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
    });
    // Every connection after the first is a reconnect — auto-reconnect, token change,
    // logout→login or a server restart alike (the Manager's own `reconnect` event only covers
    // the first case).
    this.socket.on('connect', () => {
      if (this.hasConnected) this.reconnected$.next();
      this.hasConnected = true;
    });
  }

  private getAuthToken(): string {
    return localStorage.getItem('remember_token') || '';
  }

  private ensureConnected(): void {
    const token = this.getAuthToken();
    if (!token) return;

    // Narrow socket.auth to an object before reading token to satisfy TypeScript.
    const auth = this.socket.auth;
    const currentToken =
      auth && typeof auth === 'object' && !Array.isArray(auth) ? (auth as any).token : undefined;

    if (currentToken !== token) {
      this.socket.auth = { token };
      if (this.socket.connected) {
        this.socket.disconnect();
      }
      this.isConnecting = false;
    }

    if (this.socket.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.socket.once("connect", () => {
      this.isConnecting = false;
    });
    this.socket.once("connect_error", () => {
      this.isConnecting = false;
    });
    this.socket.connect();
  }

  connect(): void {
    this.ensureConnected();
  }

  disconnect(): void {
    this.isConnecting = false;
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  // Listen for events
  on(eventName: string): Observable<any> {
    return new Observable((subscriber) => {
      // On subscribe, not on creation — long-lived (shared) streams built before login must
      // still connect once someone actually listens.
      this.ensureConnected();
      const listener = (data: any) => subscriber.next(data);
      this.socket.on(eventName, listener);
      return () => this.socket.off(eventName, listener);
    });
  }

  /** Emits each time the connection is re-established — events broadcast while disconnected
   * are lost, so consumers use this to resync (refetch) what they display. */
  onReconnect(): Observable<void> {
    return defer(() => {
      this.ensureConnected();
      return this.reconnected$;
    });
  }

  // Emit events
  emit(eventName: string, data?: any) {
    this.ensureConnected();
    this.socket.emit(eventName, data);
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket.connected;
  }
}
