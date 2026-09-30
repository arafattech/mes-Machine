import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { socketService } from 'config/socket/socket.config';
import { SyncMachine } from '@module/machine/sync-engine/sync.machine';

type PlcState = { online: boolean; dead?: boolean };

@Injectable()
export class MachineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MachineService.name);
  private readonly clients = new Set<string>();
  private readonly machineState = new Map<string, Record<string, unknown>>();
  private readonly plcState = new Map<string, PlcState>();
  private readonly frontendBroadcastIntervalMs = Number(
    process.env.MACHINE_FRONTEND_BROADCAST_MS ?? 1000,
  );
  private readonly pendingFrontendUpdates = new Map<
    string,
    Record<string, unknown>
  >();
  private frontendBroadcastTimer: NodeJS.Timeout | null = null;

  constructor(private readonly syncMachine: SyncMachine) {}

  onModuleInit() {
    this.frontendBroadcastTimer = setInterval(
      () => this.flushFrontendUpdates(),
      this.frontendBroadcastIntervalMs,
    );
    socketService.onConnection((socket) => {
      this.clients.add(socket.id);
      this.logger.log(`Client connected: ${socket.id}`);

      socket.emit('snapshot', {
        machines: Object.fromEntries(this.machineState),
        plc: Object.fromEntries(this.plcState),
      });

      for (const [machineId, payload] of this.machineState.entries()) {
        socket.emit('message', { machineId, ...payload });
      }

      for (const [machineId, state] of this.plcState.entries()) {
        socket.emit(
          'plc',
          JSON.stringify({
            machineId,
            plc: state.online ? 1 : 0,
            ...(state.dead ? { dead: true } : {}),
          }),
        );
      }

      socket.on('disconnect', () => {
        this.clients.delete(socket.id);
        this.logger.log(`Client disconnected: ${socket.id}`);
      });

      socket.on('join', (machineId, ack) => {
        const id = String(machineId ?? '');
        if (!id) { if (typeof ack === 'function') ack({ ok: false }); return; }
        socket.join(this.getMachineRoom(id));
        if (typeof ack === 'function') ack({ ok: true, machineId: id });
      });

      socket.on('from_pie', async (data, ack) => {
        const machineId = String(data?.machineId ?? '');
        if (!machineId) {
          if (typeof ack === 'function') ack({ ok: false, reason: 'machineId is required' });
          return;
        }
        await this.syncMachine.socketToRedis(data);
        this.broadcastData(machineId, data);
        if (typeof ack === 'function') {
          ack({ ok: true, connectedClients: this.getConnectedClientCount() });
        }
      });
    });
  }

  getConnectedClientCount() {
    return this.clients.size;
  }

  emit(event: string, payload: unknown) {
    socketService.emit(event, payload);
  }

  broadcastData(machineId: string | number, payload: Record<string, unknown>) {
    const id = String(machineId);
    this.machineState.set(id, payload);
    const room = this.getMachineRoom(id);
    if (socketService.roomHasClients(room)) {
      socketService.emitToRoom(room, 'message', payload);
    }
    this.pendingFrontendUpdates.set(id, payload);
  }

  /**
   * Drop a decommissioned machine's cached state — called by the pollers
   * (`ChannelMappingService`/`MachineRuntimeService`) when their config
   * refresh notices a machine is no longer active, so `machineState`/
   * `plcState` don't grow for the process lifetime as machines churn.
   */
  forgetMachine(machineId: string | number) {
    const id = String(machineId);
    this.machineState.delete(id);
    this.plcState.delete(id);
    this.pendingFrontendUpdates.delete(id);
  }

  onModuleDestroy() {
    if (this.frontendBroadcastTimer) {
      clearInterval(this.frontendBroadcastTimer);
      this.frontendBroadcastTimer = null;
    }
  }

  private flushFrontendUpdates() {
    if (this.pendingFrontendUpdates.size === 0) return;
    socketService.emit('to_frontend', Array.from(this.pendingFrontendUpdates.values()));
    this.pendingFrontendUpdates.clear();
  }

  broadcastPlcStatus(machineId: string | number, online: boolean, dead = false) {
    const id = String(machineId);
    this.plcState.set(id, { online, dead });
    const room = this.getMachineRoom(id);
    if (socketService.roomHasClients(room)) {
      socketService.emitToRoom(
        room,
        'plc',
        JSON.stringify({ machineId: id, plc: online ? 1 : 0, ...(dead ? { dead: true } : {}) }),
      );
    }
  }

  broadcastShutdown(reason: string) {
    socketService.emit('system_shutdown', {
      message: 'Server is shutting down',
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  private getMachineRoom(machineId: string) {
    return `machine_${machineId}`;
  }
}
