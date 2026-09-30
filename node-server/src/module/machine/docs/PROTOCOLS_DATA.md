# Protocols & Data Map — ESP32-P4 I/O WebServer

This is How our Plc/ ESP giving us machine data using three protocols.

How each protocol exposes the device I/O, the exact response format, data types, and the
physical-channel → protocol mapping. The device has **2 relay outputs (DO)** and
**10 digital inputs (DI)**.

## Physical channels

| Channel | Direction | GPIO | Notes |
|---------|-----------|------|-------|
| DO0 | Relay output | 6  | `false`=OFF/open, `true`=ON/energized |
| DO1 | Relay output | 20 | |
| DI0 | Digital input | 46 | Input, pull-up. Physical LOW = logical HIGH (active). Optional per-channel invert. |
| DI1 | Digital input | 53 | |
| DI2 | Digital input | 27 | |
| DI3 | Digital input | 47 | |
| DI4 | Digital input | 45 | |
| DI5 | Digital input | 1  | |
| DI6 | Digital input | 33 | |
| DI7 | Digital input | 54 | |
| DI8 | Digital input | 26 | |
| DI9 | Digital input | 48 | |

**DI modes** (per channel, set in Channel Config): `0` Normal · `1` Counter · `2` Frequency.
Counters increment on the rising edge of the (post-invert) logical state, only in Counter mode.

All protocols read the **same** in-memory state (updated by the 50 ms DI scan task), so
values always agree across HTTP, WebSocket, MQTT, and Modbus.

---

## Access paths at a glance

| Protocol | Transport | Direction | Format | Controls relays? |
|----------|-----------|-----------|--------|------------------|
| HTTP REST | TCP 80 | request/response | JSON (text) | Yes (`/api/relay`) |
| WebSocket | TCP 80 `/ws` | server push | JSON (text) | No (read-only stream) |
| MQTT | TCP to broker | publish-only | JSON (text) | No |
| Modbus TCP | TCP 502 | request/response | binary registers | **No — read-only** |

---

## 1. HTTP REST (port 80)

Text JSON over HTTP. Full control + config surface.

### `GET /api/status` → status JSON
```json
{
  "ip": "192.168.100.17",
  "wifi_ip": "",
  "wifi_connected": false,
  "version": "1.0.6",
  "copyright": "2025 PL Connect. All rights reserved.",
  "relays": [false, false],
  "inputs": [false, false, false, false, false, false, false, false, false, false],
  "counts": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `ip` | string | Ethernet IPv4 |
| `wifi_ip` | string | Wi-Fi IPv4 (empty if not connected) |
| `wifi_connected` | bool | Wi-Fi STA link state |
| `version` | string | Firmware version |
| `copyright` | string | Copyright line |
| `relays` | bool[2] | DO0, DO1 — `true`=ON |
| `inputs` | bool[10] | DI0..DI9 — `true`=active (post-invert) |
| `counts` | number[10] | Per-DI 32-bit counters (0 unless Counter mode) |

### Other endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/relay?id=<0-1>&state=<0-1>` | GET | Set a relay (only write path to outputs) |
| `/api/channel-config` | GET | Per-channel labels/modes/invert (JSON) |
| `/api/save-channel-config` | POST | Save channel config (applied live, no reboot) |
| `/api/reset-counter?ch=<n>` | GET | Reset counter (`-1` = all) |
| `/api/network-config` | GET | Wi-Fi + LAN config incl. DNS |
| `/api/save-wifi-config` / `/api/save-lan-config` | POST | Save → reboot |
| `/api/mqtt-config` / `/api/save-mqtt-config` | GET / POST | MQTT config (+status) / save → reboot |
| `/api/modbus-config` / `/api/save-modbus-config` | GET / POST | Modbus config (+status) / save → reboot |
| `/api/reboot` | POST | Reboot |
| `/`, `/style.css`, `/app.js`, `/page/*` | GET | Web UI assets |
| `/update` | GET/POST | OTA firmware page / upload |

---

## 2. WebSocket (port 80, `/ws`)

Same status JSON as `GET /api/status`, but **pushed** by the device whenever I/O state
changes (relay set, DI edge, counter reset) — no polling. On connect the device sends one
immediate snapshot. Payload schema is identical to the status JSON above. Read-only.

---

## 3. MQTT (publish-only)

When enabled, the device connects to the configured broker and **publishes** the status
JSON (identical schema to `GET /api/status`) to the configured topic every N ms.

| Item | Value |
|------|-------|
| Direction | Publish only (device → broker) |
| Payload | Status JSON (same as REST) |
| Topic | Configurable (default `esp32/status`) |
| Interval | Configurable ms (min 250) |
| QoS / retain | 0 / no |
| Auth / TLS | none (anonymous, plain TCP) |
| Controls relays? | No |

Subscribe to the topic on any MQTT client to receive the JSON. Hostname brokers require
working DNS (set a DNS server on the active interface if using static IP).

---

## 4. Modbus TCP slave (port 502) — binary, read-only

The device is a **Modbus TCP slave/server**. A master (PLC/SCADA/`mbpoll`) reads binary
registers. **No writable areas** — a master can never actuate a relay. Same values as the
JSON, encoded as Modbus registers.

- Default TCP port `502`, unit/slave ID `1` (both configurable).
- `mbpoll -r 1` starts at reference 1 (1-based); reference `N` = protocol offset `N-1`.

### Register map

| Data | Modbus table | Function | Offset | Count | `mbpoll -t` | 1-based index |
|------|--------------|----------|--------|-------|-------------|---------------|
| DI0..DI9 states | Discrete inputs (1x) | FC2 | 0–9 | 10 | `-t 1` | `[1]`–`[10]` |
| Relay DO0, DO1 states | Discrete inputs (1x) | FC2 | 10–11 | 2 | `-t 1` | `[11]`–`[12]` |
| DI0..DI9 counters | Input registers (3x) | FC4 | 0–19 | 20 | `-t 3` | `[1]`–`[20]` |

> Note on `mbpoll -t`: `0`=coils, `1`=discrete inputs, `3`=input registers, `4`=holding
> registers. This device exposes only discrete inputs (`-t 1`) and input registers (`-t 3`).
> Coils (`-t 0`) and holding (`-t 4`) are not present → a read there returns a Modbus exception.

### Data types & encoding

- **Discrete inputs** — 1 bit each. `0`=false/inactive/OFF, `1`=true/active/ON.
  Bits map: index `[1..10]` = DI0..DI9, index `[11]` = relay DO0, `[12]` = relay DO1.
- **Input registers** — 16-bit unsigned each. Counters are **32-bit**, so each counter uses
  **two consecutive registers, low word first**:
  - counter `i` (i = 0..9) → registers at offset `2*i` (low 16 bits) and `2*i+1` (high 16 bits).
  - Value = `reg[2*i] + (reg[2*i+1] << 16)`.
  - In `mbpoll -t 3 -r 1` output: counter `i` = `[2*i+1] + ([2*i+2] << 16)`.
  - Example: counter 0 = index `[1]` (low) + `[2]` (high); counter 3 = `[7]` + `[8]`.

### Example commands
```bash
# DI states + relay states (12 discrete inputs)
mbpoll -m tcp -a 1 -t 1 -r 1 -c 12 -1 192.168.100.17

# Counters (20 input registers = 10 x 32-bit)
mbpoll -m tcp -a 1 -t 3 -r 1 -c 20 -1 192.168.100.17

# Both, once each, on one line
mbpoll -m tcp -a 1 -t 1 -r 1 -c 12 -1 192.168.100.17 && \
mbpoll -m tcp -a 1 -t 3 -r 1 -c 20 -1 192.168.100.17
```

---

## Cross-protocol equivalence

The same DI3 state appears as:
- REST/WS/MQTT JSON: `inputs[3]` (bool)
- Modbus: discrete input offset 3 → `mbpoll -t 1` index `[4]`

Relay DO1:
- JSON: `relays[1]` (bool)
- Modbus: discrete input offset 11 → `mbpoll -t 1` index `[12]`

Counter for DI5:
- JSON: `counts[5]` (number)
- Modbus: input registers offset 10 & 11 → `mbpoll -t 3` index `[11]` (low) + `[12]` (high)

`false` ↔ bit `0`, `true` ↔ bit `1`. All zeros across a poll = idle I/O (no active inputs,
relays off, no counting) — not an error.
