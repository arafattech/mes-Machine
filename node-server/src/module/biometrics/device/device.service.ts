import { Logger } from "@nestjs/common";
const ZKLib = require("./local-zklib");

export class DeviceService {
  private readonly connectDelayMs = Number(
    process.env.ZKTECO_CONNECT_DELAY_MS ?? 200,
  );
  private readonly reconnectDelayMs = Number(
    process.env.ZKTECO_RECONNECT_DELAY_MS ?? 2000,
  );
  private readonly healthIntervalMs = Number(
    process.env.ZKTECO_HEALTH_INTERVAL_MS ?? 5000,
  );
  private device: any;
  private readonly logger: Logger;
  private isConnecting = false;
  private isConnected = false;
  private isStopping = false;
  private isHealthCheckRunning = false;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private healthTimer: NodeJS.Timeout | undefined;
  private state: any;

  constructor(private readonly config: any, private readonly callbacks: any) {
    this.device = this.createClient();
    this.logger = new Logger(`Device-${config.name || config.ip}`);
    this.state = this.buildState({
      status: "disconnected",
      connected: false,
      connecting: false,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
    });
  }

  static async loadConfigs(prisma: any) {
    return prisma.biometrics_device_configs.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        ip: true,
        port: true,
        timeout: true,
        inport: true,
        custom_id: true,
      },
    });
  }

  async connect() {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isStopping = false;
    this.isConnecting = true;
    this.updateState({
      status: "connecting",
      connecting: true,
      connected: false,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
    });

    try {
      this.cleanupSocket();
      this.device = this.createClient();

      await new Promise((resolve) => setTimeout(resolve, this.connectDelayMs));
      await this.device.createSocket(
        (err: any) => this.handleSocketError(err),
        (type: "tcp" | "udp") => this.handleSocketClose(type),
      );

      this.isConnected = true;
      this.updateState({
        status: "connected",
        connected: true,
        connecting: false,
        lastConnectedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
      });

      this.logger.log(`Connected: ${this.config.ip}`);
    } catch (err: any) {
      this.isConnected = false;

      this.updateState({
        status: "error",
        connected: false,
        connecting: false,
        lastDisconnectedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        lastError: err,
      });

      this.logger.error(`Connection failed: ${err}`);

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      this.reconnectTimer = setTimeout(() => {
        this.isConnecting = false;
        this.connect();
      }, this.reconnectDelayMs);

      return;
    } finally {
      this.isConnecting = false;
    }
  }

  startHealthCheck() {
    if (this.healthTimer) return;

    this.healthTimer = setInterval(() => {
      void this.runHealthCheck();
    }, this.healthIntervalMs);
  }

  stop() {
    this.isStopping = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }

    this.cleanupSocket();
    this.isConnected = false;
    this.isConnecting = false;
    this.updateState({
      status: "disconnected",
      connected: false,
      connecting: false,
      lastDisconnectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
  }

  getSnapshot() {
    return { ...this.state };
  }

  getClient() {
    return this.device;
  }

  private createClient() {
    return new ZKLib(
      this.config.ip,
      this.config.port,
      this.config.timeout,
      this.config.inport,
    );
  }

  private cleanupSocket() {
    const socket = this.getActiveSocket();
    if (!socket) return;

    try {
      socket.removeAllListeners();
      socket.end?.();
      socket.destroy?.();
      socket.unref?.();
    } catch (err: any) {
      this.logger.warn(`Cleanup error: ${err.message}`);
    }
  }

  private handleSocketError(err: any) {
    if (this.isStopping) return;

    this.isConnected = false;
    this.isConnecting = false;
    this.updateState({
      status: "error",
      connected: false,
      connecting: false,
      lastDisconnectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      lastError: err,
    });
    this.logger.error(`Socket error: ${err?.message ?? err}`);
  }

  private handleSocketClose(type: "tcp" | "udp") {
    if (this.isStopping) return;

    this.isConnected = false;
    this.isConnecting = false;
    this.updateState({
      status: "reconnecting",
      connected: false,
      connecting: false,
      lastDisconnectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
    });
    this.logger.warn(`Disconnected: ${this.config.ip} (${type})`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (!this.isStopping) {
        void this.connect();
      }
    }, this.reconnectDelayMs);
  }

  private async runHealthCheck() {
    if (this.isStopping || this.isConnecting || this.isHealthCheckRunning) {
      return;
    }

    this.isHealthCheckRunning = true;

    try {
      this.updateState({
        lastCheckedAt: new Date().toISOString(),
      });

      const socket = this.getActiveSocket();
      if (!this.isConnected || !socket || socket.destroyed || socket.closed) {
        this.updateState({
          status: "reconnecting",
          connected: false,
          connecting: true,
          lastCheckedAt: new Date().toISOString(),
          lastError: null,
        });
        this.logger.warn(`Reconnecting: ${this.config.ip}`);
        await this.connect();
        return;
      }
    } catch (err: any) {
      this.handleSocketError(err);

      if (!this.isStopping) {
        this.logger.warn(`Health check failed: ${this.config.ip}`);
        if (!this.isConnecting) {
          void this.connect();
        }
      }
    } finally {
      this.isHealthCheckRunning = false;
    }
  }

  private getActiveSocket() {
    return this.device?.zklibTcp?.socket ?? this.device?.zklibUdp?.socket ?? null;
  }

  private updateState(patch: {
    id?: string;
    customId?: string | null;
    name?: string | null;
    ip?: string;
    port?: number;
    timeout?: number;
    inport?: number;
    status?: "connecting" | "connected" | "disconnected" | "error" | "reconnecting";
    connected?: boolean;
    connecting?: boolean;
    lastCheckedAt?: string;
    lastConnectedAt?: string;
    lastDisconnectedAt?: string;
    lastError?: string | null;
  }) {
    this.state = this.buildState({
      ...this.state,
      ...patch,
    });

    this.callbacks.onStatus(this.getSnapshot());
  }

  private buildState(state: {
    id?: string;
    customId?: string | null;
    name?: string | null;
    ip?: string;
    port?: number;
    timeout?: number;
    inport?: number;
    status?: "connecting" | "connected" | "disconnected" | "error" | "reconnecting";
    connected?: boolean;
    connecting?: boolean;
    lastCheckedAt?: string;
    lastConnectedAt?: string;
    lastDisconnectedAt?: string;
    lastError?: string | null;
  }) {
    return {
      id: this.config.id,
      customId: this.config.customId ?? null,
      name: this.config.name ?? null,
      ip: this.config.ip,
      port: this.config.port,
      timeout: this.config.timeout,
      inport: this.config.inport,
      status: state.status ?? "disconnected",
      connected: state.connected ?? false,
      connecting: state.connecting ?? false,
      lastCheckedAt: state.lastCheckedAt ?? new Date().toISOString(),
      lastConnectedAt: state.lastConnectedAt,
      lastDisconnectedAt: state.lastDisconnectedAt,
      lastError: state.lastError ?? null,
    };
  }

  static toConfig(deviceConfig: any) {
    return {
      id: String(deviceConfig.id),
      customId: deviceConfig.custom_id ?? null,
      name: deviceConfig.name ?? null,
      ip: deviceConfig.ip,
      port: deviceConfig.port ?? 4370,
      timeout: deviceConfig.timeout ?? 10000,
      inport: deviceConfig.inport ?? 4000,
    };
  }
}
