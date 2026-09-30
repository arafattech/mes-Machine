import { parentPort, workerData } from 'worker_threads';
import * as net from 'net';
import jsmodbus = require('jsmodbus');
import {
  MachineCounterRow,
  MachineRuntimeConfig,
  WorkerControlMessage,
  WorkerOutMessage,
} from './machine-runtime.types';

type MachineState = {
  lastProduction: number;
  lastFault: number;
  cycleTime: number;
  lastCycleTime: number;
  shotNr: number;
  currUid: number | null;
  noData: boolean;
  heatingStart: string | null;
};

type TransportCallbacks = {
  onSignals: (rawSignals: number[]) => void;
  onDead: () => void;
  log: (msg: string) => void;
  // Fired on each connect/disconnect edge — Modbus-only, since it mirrors a
  // real persistent TCP connection's own state (see createModbusTransport).
  onConnectionChange?: (connected: boolean) => void;
};

type TransportHandle = {
  stop: () => void;
  pause?: () => void;
  resume?: () => void;
  updateIp?: (newIp: string) => void;
  updateUrl?: (newUrl: string) => void;
};

const cfg = { ...(workerData as MachineRuntimeConfig) };

const state: MachineState = {
  lastProduction: 0,
  lastFault: 0,
  cycleTime: 0,
  lastCycleTime: 0,
  shotNr: 0,
  currUid: null,
  noData: false,
  heatingStart: cfg.heating_start || null,
};

const MS = { WAITING: 'W', SHOT_START: 'S', RUNNING: 'M' } as const;

let paused = false;
let transport: TransportHandle | null = null;

function emitToParent(message: WorkerOutMessage) {
  if (!parentPort) return;
  parentPort.postMessage(message);
}

let counterRequestSeq = 0;
const pendingCounterRequests = new Map<string, (counter: MachineCounterRow | null) => void>();

/** Round-trips to the main thread's shared Prisma pool for this machine's counter row. */
function requestCounter(machineId: string): Promise<MachineCounterRow | null> {
  const requestId = `${machineId}-${++counterRequestSeq}`;
  return new Promise((resolve) => {
    pendingCounterRequests.set(requestId, resolve);
    emitToParent({ type: 'get_counter', machineId, requestId });
  });
}

function log(msg: string) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // Keep worker log format compatible with previous runtime.
  // eslint-disable-next-line no-console
  // console.log(`[${now}] [Machine ${cfg.id}] ${msg}`);
}

function applyInversion(raw: number[]) {
  const inv = cfg.invert || { F: false, P: false, A: false, ZH: false, HK: false };
  return [
    inv.F ? (raw[0] ^ 1) : raw[0],
    inv.P ? (raw[1] ^ 1) : raw[1],
    inv.A ? (raw[2] ^ 1) : raw[2],
    inv.ZH ? (raw[3] ^ 1) : raw[3],
    inv.HK ? (raw[4] ^ 1) : raw[4],
  ];
}

function saveCounter(
  machineId: string,
  shotNr: number,
  lastCycleTime: number,
  cycleTime: number,
): void {
  emitToParent({ type: 'save_counter', machineId, shotNr, lastCycleTime, cycleTime });
}

function setHeatingStart(machineId: string, timestamp: string): void {
  emitToParent({ type: 'set_heating_start', machineId, timestamp });
}

function clearHeatingStart(machineId: string): void {
  emitToParent({ type: 'clear_heating_start', machineId });
}

function recordProductionShot(machineId: string, isGood: boolean): void {
  emitToParent({ type: 'record_production_shot', machineId, isGood });
}

function handleSaveCounter(): void {
  saveCounter(cfg.id, state.shotNr, state.lastCycleTime, state.cycleTime);
}

async function handleGetStats() {
  return { avgTZ: 0, total: 0, bad: '[]' };
}

// update heat start duration
function handleHeatingElement(zh: number, hk: number): void {
  if (zh || hk) {
    if (!state.heatingStart) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      state.heatingStart = now;
      setHeatingStart(cfg.id, now);
    }
  } else if (state.heatingStart) {
    state.heatingStart = null;
    clearHeatingStart(cfg.id);
  }
}

async function processSignals(rawSignals: number[]) {

  if (paused) return;

  const [fault, production, automatic, zh, hk] = applyInversion(rawSignals);
  const faultEdge = fault === 1 && state.lastFault === 0 ? 1 : 0;
  state.lastFault = fault;

  let machineState: string = MS.WAITING;
  let isNewShot = false;

  if (automatic === 1) {
    state.cycleTime += 1;
    if (production === 1 && state.lastProduction === 0) {
      state.shotNr += 1;
      state.lastCycleTime = state.cycleTime;
      state.cycleTime = 0;
      isNewShot = true;
      machineState = MS.SHOT_START;
    } else {
      machineState = MS.RUNNING;
    }
  } else {
    state.cycleTime += 1;
    machineState = MS.WAITING;
  }

  state.lastProduction = production;

  if (isNewShot && automatic === 1) {
    handleSaveCounter();
    recordProductionShot(cfg.id, true);
  }

  handleHeatingElement(zh, hk);
  const running =
    state.lastCycleTime > 0 && state.lastCycleTime <= Number(cfg.taktzeit ?? 999) ? 1 : 0;
  const { avgTZ, total, bad } = await handleGetStats();

  emitToParent({
    type: 'data',
    machineId: cfg.id,
    payload: {
      MNR: cfg.id,
      transport: cfg.transport || 'modbus',
      F: faultEdge,
      P: production,
      I: machineState,
      C: state.lastCycleTime,
      A: automatic,
      ZH: zh,
      HK: hk,
      R: running,
      S: state.shotNr,
      T: state.cycleTime,
      TZ: avgTZ,
      Total: total,
      Bad: bad,
      heat: state.heatingStart,
    },
  });
}

// create modbus treansport ======================================
function createModbusTransport(
  ip: string,
  callbacks: TransportCallbacks,
  pollIntervalMs: number,
  requestTimeoutMs: number,
): TransportHandle {
  const MAX_DELAY = 30000;
  const MAX_RETRIES = 20;
  let tcpSocket: net.Socket | null = null;
  let modbusClient: any = null;
  let connected = false;
  let stopping = false;
  let reconnectDelay = 1000;
  let retryCount = 0;
  let currentIp = ip;
  let pollTimer: NodeJS.Timeout | null = null;

  const stopPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  const handleDisconnect = () => {
    if (!connected) return;
    connected = false;
    callbacks.onConnectionChange?.(false);
    stopPolling();
    tcpSocket?.destroy();
    if (stopping) return;

    retryCount += 1;
    if (retryCount >= MAX_RETRIES) {
      callbacks.log(`Max retries (${MAX_RETRIES}) exceeded`);
      callbacks.onDead();
      return;
    }

    callbacks.log(
      `Reconnecting in ${reconnectDelay / 1000}s (attempt ${retryCount}/${MAX_RETRIES})`,
    );
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  };

  const poll = async () => {
    if (!connected || !modbusClient) return;
    try {
      const resp = await modbusClient.readDiscreteInputs(0, 5);
      callbacks.onSignals(resp.response.body.valuesAsArray);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      callbacks.log(`Poll error: ${message}`);
      handleDisconnect();
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => void poll(), pollIntervalMs);
  };

  const connect = () => {
    if (stopping) return;

    tcpSocket = new net.Socket();
    modbusClient = new jsmodbus.client.TCP(tcpSocket, 0);
    // Guard the connect only: fires if the PLC does not accept the TCP
    // connection within the timeout. Disabled once connected so the idle
    // gap between polls never tears down a live socket.
    tcpSocket.setTimeout(requestTimeoutMs);
    tcpSocket.connect({ host: currentIp, port: 502 });

    tcpSocket.on('timeout', () => {
      callbacks.log(`Connect timeout after ${requestTimeoutMs}ms`);
      tcpSocket?.destroy();
    });

    tcpSocket.on('connect', () => {
      connected = true;
      callbacks.onConnectionChange?.(true);
      reconnectDelay = 1000;
      retryCount = 0;
      tcpSocket?.setTimeout(0);
      callbacks.log('Modbus connected');
      startPolling();
    });

    tcpSocket.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      callbacks.log(`Socket error: ${message}`);
      handleDisconnect();
    });

    tcpSocket.on('close', () => {
      if (connected) {
        callbacks.log('Connection closed');
        handleDisconnect();
      }
    });
  };

  connect();

  return {
    stop: () => {
      stopping = true;
      stopPolling();
      tcpSocket?.destroy();
    },
    updateIp: (newIp: string) => {
      currentIp = newIp;
      connected = false;
      stopping = false;
      reconnectDelay = 1000;
      retryCount = 0;
      stopPolling();
      tcpSocket?.destroy();
      callbacks.log(`IP changed to ${newIp} - reconnecting`);
      setTimeout(connect, 500);
    },
  };
}

// create api traensport
function createApiTransport(
  url: string,
  callbacks: TransportCallbacks,
  map: Record<string, number> | null,
  machineId: string,
  pollIntervalMs: number,
  requestTimeoutMs: number,
): TransportHandle {
  const DEFAULT_SIGNAL_MAP = { F: 1, P: 2, A: 3, ZH: 4, HK: 5 };
  const REQUEST_TIMEOUT = requestTimeoutMs;
  const MAX_ERRORS = 20;
  let pollTimer: NodeJS.Timeout | null = null;
  let stopping = false;
  let errorCount = 0;
  let pausedState = false;
  let currentUrl = url;
  const signalMap = { ...DEFAULT_SIGNAL_MAP, ...(map ?? {}) };

  const parseRelayStates = (xml: string) => {
    const relays = new Map<number, number>();
    const decoded = xml
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, '&');

    const pattern1 = /<input(\d+)state>\s*(\d)\s*<\/input\d+state>/gi;
    let match: RegExpExecArray | null = null;
    while ((match = pattern1.exec(decoded)) !== null) {
      relays.set(parseInt(match[1], 10), parseInt(match[2], 10) === 1 ? 1 : 0);
    }

    const pattern1b = /<relay(\d+)state>\s*(\d)\s*<\/relay\d+state>/gi;
    while ((match = pattern1b.exec(decoded)) !== null) {
      relays.set(parseInt(match[1], 10), parseInt(match[2], 10) === 1 ? 1 : 0);
    }

    const pattern2 =
      /<relayState[^>]+index\s*=\s*["'](\d+)["'][^>]*>\s*(\d)\s*<\/relayState>/gi;
    while ((match = pattern2.exec(decoded)) !== null) {
      relays.set(parseInt(match[1], 10), parseInt(match[2], 10) === 1 ? 1 : 0);
    }

    // Fallback 1: namespaced/attribute variants, e.g. <ns:relay1state ...>1</ns:relay1state>
    if (!relays.size) {
      const patternNsInput =
        /<(?:\w+:)?input(\d+)state\b[^>]*>\s*([01])\s*<\/(?:\w+:)?input\d+state>/gi;
      while ((match = patternNsInput.exec(decoded)) !== null) {
        relays.set(parseInt(match[1], 10), parseInt(match[2], 10) === 1 ? 1 : 0);
      }

      const patternNsRelay =
        /<(?:\w+:)?relay(\d+)state\b[^>]*>\s*([01])\s*<\/(?:\w+:)?relay\d+state>/gi;
      while ((match = patternNsRelay.exec(decoded)) !== null) {
        relays.set(parseInt(match[1], 10), parseInt(match[2], 10) === 1 ? 1 : 0);
      }
    }

    // Fallback 2: key=value style payloads, e.g. relay1state=1
    if (!relays.size) {
      const keyValuePattern =
        /(?:relay|input)(\d+)state\s*[:=]\s*["']?([01])["']?/gi;
      while ((match = keyValuePattern.exec(decoded)) !== null) {
        relays.set(parseInt(match[1], 10), parseInt(match[2], 10) === 1 ? 1 : 0);
      }
    }

    // Fallback 3: plain array payloads, e.g. [0,0,1,0,1]
    if (!relays.size) {
      const arrayMatch = decoded.match(/\[\s*[01](?:\s*,\s*[01]){4,}\s*\]/);
      if (arrayMatch) {
        const values = arrayMatch[0]
          .replace('[', '')
          .replace(']', '')
          .split(',')
          .map((x) => (Number(x.trim()) === 1 ? 1 : 0));

        values.forEach((v, i) => relays.set(i + 1, v));
      }
    }

    if (!relays.size) {
      const sample = decoded.replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(`No relay states found in XML response: ${sample}`);
    }

    return relays;
  };

  const mapSignals = (relays: Map<number, number>) => {
    return [
      relays.get(signalMap.F) ?? 0,
      relays.get(signalMap.P) ?? 0,
      relays.get(signalMap.A) ?? 0,
      relays.get(signalMap.ZH) ?? 0,
      relays.get(signalMap.HK) ?? 0,
    ];
  };

  const fetchXml = (target: string): Promise<string> => {

    // console.log(target , 'xml target data');
    return new Promise((resolve, reject) => {
      const parsed = new URL(target);
      const host = parsed.hostname;
      const port = parsed.port ? Number(parsed.port) : 80;
      const path = parsed.pathname + (parsed.search || '');
      const client = new net.Socket();
      let raw = '';

      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('Request timeout'));
      }, REQUEST_TIMEOUT);

      client.connect(port, host, () => {
        client.write(
          `GET ${path} HTTP/1.0\r\n` +
          `Host: ${host}\r\n` +
          `Connection: close\r\n\r\n`,
        );
      });

      client.on('data', (chunk) => {
        raw += chunk.toString('latin1');
      });

      client.on('close', () => {
        clearTimeout(timeout);
        const parts = raw.split(/\r?\n\r?\n/);
        const httpBody = parts.length > 1 ? parts.slice(1).join('\n\n') : raw;
        const xmlStart = httpBody.indexOf('<?xml');
        const body = xmlStart >= 0 ? httpBody.slice(xmlStart) : httpBody;
        if (!body.trim()) {
          reject(new Error('Empty response'));
          return;
        }
        resolve(body);
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  };

  const poll = async () => {
    if (stopping || pausedState) return;

    try {
      const xml = await fetchXml(currentUrl);
      const relays = parseRelayStates(xml);
      callbacks.onSignals(mapSignals(relays));
      errorCount = 0;
    } catch (error) {
      errorCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      callbacks.log(`API poll error (${errorCount}/${MAX_ERRORS}): ${message}`);
      if (errorCount >= MAX_ERRORS) {
        callbacks.log('Max errors exceeded - marking as dead');
        if (pollTimer) clearInterval(pollTimer);
        callbacks.onDead();
      }
    }
  };

  callbacks.log(
    `Signal map: F=relay${signalMap.F} P=relay${signalMap.P} A=relay${signalMap.A} ZH=relay${signalMap.ZH} HK=relay${signalMap.HK}`,
  );
  callbacks.log(`API transport URL: ${currentUrl}`);
  pollTimer = setInterval(() => void poll(), pollIntervalMs);

  return {
    stop: () => {
      stopping = true;
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    },
    updateUrl: (newUrl: string) => {
      currentUrl = newUrl;
      callbacks.log(`URL updated to ${currentUrl}`);
    },
    pause: () => {
      pausedState = true;
    },
    resume: () => {
      pausedState = false;
    },
  };
}

function startTransport() {
  const type = cfg.transport || 'modbus';
  const isApi = type === 'api';

  const pollIntervalMs =
    cfg.poll_interval_ms ??
    (isApi ? Number(process.env.MACHINE_PULL_DURATION) || 2000 : 1000);
  const requestTimeoutMs = cfg.request_timeout_ms ?? 3000;

  const callbacks: TransportCallbacks = {
    onSignals: (signals) => void processSignals(signals),
    onDead: () => emitToParent({ type: 'dead', machineId: cfg.id }),
    onConnectionChange: (connected) =>
      emitToParent({ type: 'connection', machineId: cfg.id, connected }),
    log,
  };

  if (isApi) {
    transport = createApiTransport(
      cfg.api_url || '',
      callbacks,
      cfg.api_signal_map || null,
      cfg.id,
      pollIntervalMs,
      requestTimeoutMs,
    );
  } else {
    transport = createModbusTransport(
      cfg.ip,
      callbacks,
      pollIntervalMs,
      requestTimeoutMs,
    );
  }
  log(`Transport: ${type} (poll ${pollIntervalMs}ms, timeout ${requestTimeoutMs}ms)`);
}

function restartTransport() {
  transport?.stop();
  startTransport();
}

async function loadInitialState() {
  const counter = await requestCounter(cfg.id);
  if (counter) {
    state.shotNr = counter.shot_nr;
    state.lastCycleTime = counter.last_cycle_time;
    state.cycleTime = counter.cycle_time;
    state.currUid = counter.shot_nr;
    log(
      `Counter restored - shot: ${state.shotNr}, lastCycle: ${state.lastCycleTime}s, elapsed: ${state.cycleTime}s`);
    return;
  }

  saveCounter(cfg.id, 0, 0, 0);
  state.shotNr = 0;
  state.lastCycleTime = 0;
  state.cycleTime = 0;
  state.lastProduction = 0;
  state.currUid = 0;
  state.noData = true;
  log('No counter row found - created fresh counter state');
}

function stopWorker(): void {
  handleSaveCounter();
  transport?.stop();
  process.exit(0);
}

function applyRuntimeUpdate(next: Partial<MachineRuntimeConfig>) {
  if (next.invert) {
    cfg.invert = { ...(cfg.invert || {}), ...next.invert };
    delete (next as any).invert;
  }
  Object.assign(cfg, next);
}

parentPort?.on('message', (msg: WorkerControlMessage) => {
  switch (msg.type) {
    case 'stop':
      stopWorker();
      break;
    case 'pause':
      paused = true;
      transport?.pause?.();
      break;
    case 'resume':
      paused = false;
      transport?.resume?.();
      break;
    case 'config_update': {
      const timingChanged =
        msg.config.poll_interval_ms !== undefined ||
        msg.config.request_timeout_ms !== undefined;
      applyRuntimeUpdate(msg.config);
      // Interval/timeout are captured when the transport is built, so a live
      // change only takes effect after rebuilding it.
      if (timingChanged) restartTransport();
      break;
    }
    case 'ip_change':
      cfg.ip = msg.ip;
      transport?.updateIp?.(msg.ip);
      break;
    case 'url_change':
      cfg.api_url = msg.api_url;
      transport?.updateUrl?.(msg.api_url);
      break;
    case 'counter_result': {
      const resolve = pendingCounterRequests.get(msg.requestId);
      if (resolve) {
        pendingCounterRequests.delete(msg.requestId);
        resolve(msg.counter);
      }
      break;
    }
  }
});

void (async () => {
  try {
    await loadInitialState();
    startTransport();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitToParent({ type: 'error', machineId: cfg.id, error: message });
  }
})();
