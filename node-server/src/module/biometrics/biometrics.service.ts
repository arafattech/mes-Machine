import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import axios from "axios";
import moment from "moment";
import { PrismaService } from "@prisma/prisma.service";
import { GetRedisClient } from "config/redis/config.redis";
import { socketService } from "config/socket/socket.config";
import { DeviceService } from "./device/device.service";
import {
  AttendanceCheckoutQueueService,
  formatCheckoutTime,
} from "./queue/attendance-checkout.queue";

/** Minimum gap (ms) between two punches for the same employee. */
const MIN_PUNCH_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

const MINUTES_IN_DAY = 24 * 60;

interface ShiftMatch {
  shift: any;
  isLate: boolean;
  lateMinutes: number;
  /** Shift was assigned as a fallback (window match outside the roster, or pure
   * proximity with no window match at all) — never VALID/LATE, always INVALID. */
  forceInvalid?: boolean;
}

interface IngestAck {
  ok: boolean;
  status: "processed" | "duplicate" | "queued" | "rejected" | "error";
  reason?: string;
}

@Injectable()
export class BiometricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BiometricsService.name);
  private readonly redis = GetRedisClient();
  private readonly deviceInstances: { id: string; device: DeviceService }[] =
    [];
  private readonly deviceState: any[] = [];
  private get isReadFromMicroservice() {
    return process.env.BIOMETRICS_FROM_MICROSERVICE === "true";
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceCheckoutQueue: AttendanceCheckoutQueueService,
  ) {}

  async onModuleInit() {
    socketService.onConnection((socket) => {
      this.logger.log(`Client connected: ${socket.id}`);
      socket.emit("biometrics_snapshot", { devices: this.getDeviceSnapshot() });

      socket.on(
        "attendance_micro",
        (data: { deviceUserId: string; recordTime: string }) => {
          void this.processRealtimeAttendance(data, socket.id);
        },
      );

      socket.on("device_status", (state: Record<string, boolean>) => {
        this.updateDeviceStateFromClient(state);
      });

      socket.on("biometric-attendance", async (payload, ack) => {
        if (!payload?.employee_no || !payload?.punch_time) {
          if (typeof ack === "function")
            ack({
              ok: false,
              status: "rejected",
              reason: "missing employee_no or punch_time",
            });
          return;
        }
        const result = await this.processRealtimeAttendance(
          {
            deviceUserId: payload.employee_no,
            userId: payload.employee_no,
            recordTime: payload.punch_time,
            attTime: payload.punch_time,
          },
          payload.device_id,
        );
        if (typeof ack === "function") ack(result);
      });

      socket.on("biometrics_reload", async (_, ack) => {
        if (!this.isReadFromMicroservice) await this.reloadDevices();
        if (typeof ack === "function") ack({ ok: true });
      });

      socket.on("biometrics_roster_reload", async (_, ack) => {
        const authToken = socket.handshake?.auth?.token;
        await this.refreshRosterCacheWindow(authToken);
        if (typeof ack === "function") ack({ ok: true });
      });

      socket.on("biometrics_roster_invalidate", async (payload, ack) => {
        const dates = [
          ...(payload?.date ? [payload.date] : []),
          ...(payload?.dates ?? []),
        ].filter(Boolean);
        await this.invalidateRosterCacheByDates(dates);
        if (typeof ack === "function") ack({ ok: true, dates });
      });

      socket.on("disconnect", () => {
        this.logger.log(`Client disconnected: ${socket.id}`);
      });
    });

// will need for further testing
    // const checkInPayload = {
    //   deviceUserId: 10133,
    //   recordTime: "2026-09-14 22:30:00",
    //   device_id: "DEVICE001",
    // };
    // const checkOutPayload = {
    //   deviceUserId: 10133,
    //   recordTime: "2026-09-14 18:50:00",
    //   device_id: "DEVICE001",
    // };

    // void this.processRealtimeAttendance(checkInPayload, "DEVICE001").then(() =>
    //   this.processRealtimeAttendance(checkOutPayload, "DEVICE001"),
    // );


    if (!this.isReadFromMicroservice) {
      void this.reloadDevices().catch(() => {});
    }
    
  }

  async onModuleDestroy() {
    for (const item of this.deviceInstances) item.device.stop();
    this.deviceInstances.length = 0;
    this.deviceState.length = 0;
  }

  private updateDeviceStateFromClient(state: Record<string, boolean>) {
    for (const [key, online] of Object.entries(state)) {
      const existingIndex = this.deviceState.findIndex((s) => s.id === key);
      const entry = {
        id: key,
        name: key,
        ip: key,
        status: online ? "connected" : "disconnected",
        connected: online,
        connecting: false,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
      };
      if (existingIndex >= 0) {
        this.deviceState[existingIndex] = entry;
      } else {
        this.deviceState.push(entry);
      }
      this.emitDeviceStatus(entry);
    }
    this.emitSnapshot();
  }

  async reloadDevices() {
    const devices = await DeviceService.loadConfigs(this.prisma as any);

    for (const item of this.deviceInstances) {
      item.device.stop();
    }

    this.deviceInstances.length = 0;
    this.deviceState.length = 0;

    for (const deviceConfig of devices as any[]) {
      const config = DeviceService.toConfig(deviceConfig);
      this.deviceState.push({
        ...config,
        status: "disconnected",
        connected: false,
        connecting: false,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
      });

      if (this.deviceInstances.some((item) => item.id === config.id)) {
        continue;
      }

      const device = new DeviceService(config, {
        onStatus: (state) => this.handleDeviceStatus(state),
      });

      this.deviceInstances.push({ id: config.id, device });
      await device.connect();
      const client = device.getClient();
      // await this.readAllUsers(client, config.ip).catch(() => {});
      await this.readLatestCheckInOut(client, config.ip).catch(() => {});
      device.startHealthCheck();
    }

    this.emitSnapshot();
  }

  async getUsers(device: any) {
    return device.getUsers();
  }

  async getAttendances(device: any, onProgress?: any) {
    return device.getAttendances(onProgress);
  }

  getRealTimeLogs(device: any, onEvent: any) {
    return device.getRealTimeLogs(onEvent);
  }

  async disconnect(device: any) {
    return device.disconnect();
  }

  // will need latter
  // async readAllUsers(device: any, deviceIp: string) {
  //   const users = await this.getUsers(device);
  //   const records = Array.isArray(users) ? users : users?.data ?? [];
  //   console.log(`[${deviceIp}] users list:`, records);
  //   return records;
  // }

  async readLatestCheckInOut(device: any, deviceIp: string) {
    const attendance = await this.getAttendances(device);
    const records = Array.isArray(attendance)
      ? attendance
      : (attendance?.data ?? []);

    const latest = records.reduce((best: any, item: any) => {
      const currentRecordTime = moment(item?.recordTime ?? 0).valueOf();
      const bestRecordTime = moment(best?.recordTime ?? 0).valueOf();
      return currentRecordTime > bestRecordTime ? item : best;
    }, null);

    this.processRealtimeAttendance(latest, deviceIp);
    void this.getRealTimeLogs(device, (data: any) => {
      void this.processRealtimeAttendance(data, deviceIp);
    });
    return latest;
  }

  private async processRealtimeAttendance(
    data: any,
    deviceIp: string,
  ): Promise<IngestAck> {
    console.log("data from device", data);
    try {
      this.emitAttendance(data);
      // console.log(data, "data from device");
      const employeeNo = data?.deviceUserId ?? data?.userId;
      const attendanceValue = data?.recordTime ?? data?.attTime;

      const attendanceMoment = moment.utc(
        moment(attendanceValue).format("YYYY-MM-DD HH:mm:ss"),
        "YYYY-MM-DD HH:mm:ss",
      );
      const attendanceTime = attendanceMoment.toDate();
      // console.log(attendanceTime, "time from device");
      if (!employeeNo || !attendanceMoment.isValid()) {
        console.error(`[${deviceIp}] Invalid attendance data:`, data);
        return {
          ok: false,
          status: "rejected",
          reason: "invalid attendance data",
        };
      }

      const dateKey = attendanceMoment.format("YYYY-MM-DD");
      let cachedRoster = await this.redis.get(`biometrics:roster:${dateKey}`);

      if (!cachedRoster) {
        // No roster snapshot for this date — pull it fresh from Laravel and cache
        // it before falling back to the live-DB / unrostered path below. Device
        // punches carry no user session, so this uses the internal-service token
        // (reloadRosterCache no-ops quietly if LARAVEL_URL/token aren't set).
        await this.reloadRosterCache(dateKey, 1, undefined, undefined);
        cachedRoster = await this.redis.get(`biometrics:roster:${dateKey}`);
      }

      let employee: any = null;
      let shifts: any[] = [];
      let inRoster = true;

      if (!cachedRoster) {
        const employeeRecord = await this.prisma.employees.findFirst({
          where: { employee_no: Number(employeeNo) },
          select: { id: true, employee_type_id: true, group_id: true },
        });
        if (!employeeRecord?.id) {
          return { ok: false, status: "queued", reason: "employee not found" };
        }
        employee = employeeRecord;

        // No roster cached for this date — before assuming "unrostered", check
        // the roster/override tables directly. The Redis snapshot is only a
        // perf cache; a cold/expired/mid-reload cache must not override the
        // real roster state.
        const liveShifts = await this.resolveLiveRosterShifts(
          employeeRecord.id,
          employeeRecord.group_id,
          dateKey,
        );

        if (liveShifts.length) {
          inRoster = true;
          shifts = liveShifts;
        } else {
          inRoster = false;
          const activeShifts = await this.prisma.employee_shifts.findMany({
            where: { is_active: true },
            select: {
              id: true,
              start_time: true,
              late_start_time: true,
              early_start_time: true,
              end_time: true,
            },
          });
          shifts = activeShifts.map((shift) => ({
            shift_id: shift.id,
            start_time: shift.start_time,
            late_start_time: shift.late_start_time,
            early_start_time: shift.early_start_time,
            end_time: shift.end_time,
          }));
        }
      } else {
        const rosterData = this.getRosterData(cachedRoster);
        const dayShifts = Object.values(rosterData?.shifts ?? {}) as any[];

        const rosteredShifts: any[] = [];
        let rosterEmployee: any = null;

        for (const shift of dayShifts) {
          const matched = shift.employees?.find(
            (item: any) =>
              String(item.employee_details?.employee_no) === String(employeeNo),
          );

          if (!matched) continue;

          rosterEmployee = rosterEmployee ?? matched.employee_details;

          const { employees, ...shiftInfo } = shift;
          rosteredShifts.push({
            day: rosterData?.day,
            ...shiftInfo,
            employee_status: matched.status,
            override_info: matched.override_info,
          });
        }

        const employeeRecord = await this.prisma.employees.findFirst({
          where: { employee_no: Number(employeeNo) },
          select: { id: true, employee_type_id: true },
        });

        employee = employeeRecord ?? rosterEmployee;

        // No employee row → cannot create attendance (FK employee_id required).
        if (!employee?.id) {
          return { ok: false, status: "queued", reason: "employee not found" };
        }

        inRoster = rosteredShifts.length > 0;
        shifts = rosteredShifts.length
          ? rosteredShifts
          : dayShifts.map((shift) => {
              const { employees, ...shiftInfo } = shift;
              return { day: rosterData?.day, ...shiftInfo };
            });
      }

      const [openAttendance, lastClosedAttendance] = await Promise.all([
        this.prisma.attendance_logs.findFirst({
          where: { employee_id: employee.id, check_out_time: null },
          orderBy: { check_in_time: "desc" },
        }),
        this.prisma.attendance_logs.findFirst({
          where: { employee_id: employee.id, check_out_time: { not: null } },
          orderBy: { check_out_time: "desc" },
        }),
      ]);

      // Block punch if it is within MIN_PUNCH_INTERVAL_MS of the last checkout
      if (lastClosedAttendance?.check_out_time) {
        const sinceCheckout =
          attendanceTime.getTime() -
          lastClosedAttendance.check_out_time.getTime();
        if (sinceCheckout >= 0 && sinceCheckout < MIN_PUNCH_INTERVAL_MS) {
          return { ok: true, status: "duplicate" };
        }
      }

      const attendanceMinutes =
        attendanceMoment.hours() * 60 + attendanceMoment.minutes();

      // Only queried when the roster shift(s) don't window-match the punch — the
      // common case (punch actually within the roster shift) never pays for this.
      const getAllActiveShifts = async (): Promise<any[]> => {
        if (!inRoster) return shifts;
        const activeShiftRows = await this.prisma.employee_shifts.findMany({
          where: { is_active: true },
          select: {
            id: true,
            start_time: true,
            late_start_time: true,
            early_start_time: true,
            end_time: true,
          },
        });
        return activeShiftRows.map((shift) => ({
          shift_id: shift.id,
          start_time: shift.start_time,
          late_start_time: shift.late_start_time,
          early_start_time: shift.early_start_time,
          end_time: shift.end_time,
        }));
      };

      const shiftMatch = await this.resolveShiftMatch(
        shifts,
        attendanceMinutes,
        getAllActiveShifts,
      );
      const matchedShift = shiftMatch?.shift ?? null;

      const inShift = Boolean(matchedShift);
      const status = !inRoster || !inShift || shiftMatch!.forceInvalid
        ? "INVALID"
        : shiftMatch!.isLate
          ? "LATE"
          : "VALID";
      const lateMinutes =
        shiftMatch && !shiftMatch.forceInvalid && shiftMatch.isLate
          ? shiftMatch.lateMinutes
          : null;

      if (!openAttendance) {
        // console.log(openAttendance, "data");
        const isOt = await this.resolveCheckInOt(
          employee.id,
          dateKey,
          inRoster,
          matchedShift,
        );
        await this.prisma.attendance_logs.create({
          data: {
            employee_id: employee.id,
            employee_no: Number(employeeNo),
            attendance_date: attendanceTime,
            device_ip: deviceIp,
            check_in_time: attendanceTime,
            status: status,
            late_minutes: lateMinutes,
            shift_id: matchedShift?.shift_id ?? null,
            is_ot: isOt,
            employee_type_id: employee.employee_type_id,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        return { ok: true, status: "processed" };
      }

      if (openAttendance.check_in_time.getTime() === attendanceTime.getTime()) {
        return { ok: true, status: "duplicate" };
      }

      const elapsed =
        attendanceTime.getTime() - openAttendance.check_in_time.getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;

      if (elapsed >= twentyFourHoursMs) {
        // Open attendance is stale (>24 h) — start fresh check-in instead of checkout
        const isOt = await this.resolveCheckInOt(
          employee.id,
          dateKey,
          inRoster,
          matchedShift,
        );
        await this.prisma.attendance_logs.create({
          data: {
            employee_id: employee.id,
            employee_no: Number(employeeNo),
            attendance_date: attendanceTime,
            device_ip: deviceIp,
            check_in_time: attendanceTime,
            status: status,
            late_minutes: lateMinutes,
            employee_type_id: employee.employee_type_id,
            shift_id: matchedShift?.shift_id ?? null,
            is_ot: isOt,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        return { ok: true, status: "processed" };
      }

      if (elapsed > MIN_PUNCH_INTERVAL_MS) {
        await this.prisma.attendance_logs.update({
          where: { id: openAttendance.id },
          data: {
            check_out_time: attendanceTime,
            updated_at: new Date(),
          },
        });
        // Overtime/night-shift/attendance/ramadan/eid bonus calculation lives in
        // AttendanceCheckoutService/OvertimeBonusService (Laravel) — queue a call to it
        // instead of duplicating that payroll logic here or hitting Laravel inline: a
        // burst of device checkouts would otherwise fire one concurrent HTTP request per
        // punch. See AttendanceCheckoutQueueService for the rate-limited worker.
        void this.attendanceCheckoutQueue.enqueue({
          attendanceLogId: String(openAttendance.id),
          checkOutTime: formatCheckoutTime(attendanceTime),
        });
        return { ok: true, status: "processed" };
      }

      return { ok: true, status: "duplicate" };
    } catch (error) {
      console.error(`[${deviceIp}] Error processing attendance:`, error);
      return {
        ok: false,
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Picks the shift a punch belongs to, in three tiers:
  //  1. Does it fall within (early_start_time..end_time of) one of the employee's
  //     OWN roster shifts? If so, that's it — VALID, or LATE past late_start_time.
  //  2. Otherwise, does it fall within some OTHER active shift's window? The
  //     employee is clearly working that shift even though it's not what they
  //     were rostered for — assign it, but always INVALID (never VALID/LATE).
  //  3. Otherwise (no window match anywhere) — fall back to whichever roster
  //     shift's start_time is nearest the punch, still always INVALID. Never
  //     returns null while the employee has at least one roster shift.
  private async resolveShiftMatch(
    rosterShifts: any[],
    attendanceMinutes: number,
    getAllActiveShifts: () => Promise<any[]>,
  ): Promise<ShiftMatch | null> {
    const now = attendanceMinutes;

    const rosterHit = this.findShiftWindowMatch(rosterShifts, now);
    if (rosterHit) return rosterHit;

    const allActiveShifts = await getAllActiveShifts();
    const otherHit = this.findShiftWindowMatch(allActiveShifts, now);
    if (otherHit) {
      return { shift: otherHit.shift, isLate: false, lateMinutes: 0, forceInvalid: true };
    }

    const nearestShift = this.pickNearestShift(rosterShifts, now);
    if (!nearestShift) return null;
    return { shift: nearestShift, isLate: false, lateMinutes: 0, forceInvalid: true };
  }

  // First shift in the list whose window actually contains the punch — either
  // within [start_time, end_time] (wrapping past midnight for overnight shifts),
  // or before start_time down to the shift's configured early_start_time (no
  // early_start_time configured means no early allowance for that shift). Once
  // within the shift, LATE is judged against late_start_time (the configured
  // grace cutoff, defaulting to start_time itself when unset); early is always
  // on time, never late.
  private findShiftWindowMatch(shifts: any[], now: number): ShiftMatch | null {
    for (const shift of shifts) {
      // Prisma returns MySQL TIME/DATETIME columns as UTC-based Date objects.
      // attendanceMoment is explicitly UTC-tagged (see caller) so its
      // .hours()/.minutes() read the raw device wall-clock value with no
      // local-TZ shift — shift boundaries must be read the same way, or a
      // non-UTC server timezone silently offsets them relative to the punch.
      const startMoment = moment.utc(shift.start_time);
      const endMoment = moment.utc(shift.end_time);
      if (!startMoment.isValid() || !endMoment.isValid()) continue;

      const start = startMoment.hours() * 60 + startMoment.minutes();
      const end = endMoment.hours() * 60 + endMoment.minutes();

      const withinShift =
        start <= end
          ? now >= start && now <= end // normal shift
          : now >= start || now <= end; // overnight shift

      if (withinShift) {
        const isOvernight = start > end;
        // How many minutes `point` sits after `start`, following the same "which
        // day" rule as the shift itself: for an overnight shift, a `point` at/
        // before `end` is the next-day tail of the shift that began the previous
        // evening, so it wraps forward from `start`.
        const minutesFromStart = (point: number): number =>
          isOvernight && point <= end ? point + MINUTES_IN_DAY - start : point - start;

        const minutesSinceStart = minutesFromStart(now);
        const lateStartMoment = shift.late_start_time ? moment.utc(shift.late_start_time) : null;
        const graceMinutes = lateStartMoment?.isValid()
          ? minutesFromStart(lateStartMoment.hours() * 60 + lateStartMoment.minutes())
          : 0;

        const isLate = minutesSinceStart > graceMinutes;
        return { shift, isLate, lateMinutes: isLate ? minutesSinceStart : 0 };
      }

      // How many minutes before `start` (wrapping the 24h clock) `now` sits — 0
      // if now === start, growing the earlier `now` is; irrelevant once `now` is
      // at or past `start` (already handled above).
      const minutesBeforeStart = ((start - now) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;

      const earlyStartMoment = shift.early_start_time ? moment.utc(shift.early_start_time) : null;
      const earlyWindowMinutes = earlyStartMoment?.isValid()
        ? ((start - (earlyStartMoment.hours() * 60 + earlyStartMoment.minutes())) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY
        : 0;

      const isEarlyMatch =
        minutesBeforeStart > 0 && minutesBeforeStart <= earlyWindowMinutes;

      if (isEarlyMatch) {
        return { shift, isLate: false, lateMinutes: 0 };
      }
    }

    return null;
  }

  // Whichever shift's start_time is closest (in minutes, wrapping the 24h
  // clock) to the punch — last-resort tier when nothing actually window-matches.
  private pickNearestShift(shifts: any[], now: number): any | null {
    const candidates = shifts
      .map((shift) => {
        const startMoment = moment.utc(shift.start_time);
        if (!startMoment.isValid()) return null;
        return { shift, start: startMoment.hours() * 60 + startMoment.minutes() };
      })
      .filter((candidate): candidate is { shift: any; start: number } => candidate !== null);

    if (!candidates.length) return null;

    return candidates.reduce((best, candidate) =>
      this.circularMinuteDistance(now, candidate.start) <
      this.circularMinuteDistance(now, best.start)
        ? candidate
        : best,
    ).shift;
  }

  private circularMinuteDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % MINUTES_IN_DAY;
    return Math.min(diff, MINUTES_IN_DAY - diff);
  }

  // Check-in OT rule (mirrors Backend EmployeeRosterService::resolveIsOt):
  //  - The shift actually matched for this check-in is an EXTRA-type roster
  //    assignment → this check-in itself is OT. Must look at the MATCHED shift
  //    specifically, not any shift the employee happens to be rostered onto that
  //    day — an employee can be "Regular" on one roster shift and merely a
  //    secondary/pivot-group member (often tagged EXTRA) on another, and only
  //    the shift the punch actually landed on should decide OT.
  //  - Not rostered today at all → not OT by itself, but if the employee already
  //    has an earlier attendance log the same day, this is their 2nd+ session —
  //    retroactively flag the earlier log(s) as OT.
  private async resolveCheckInOt(
    employeeId: bigint,
    dateKey: string,
    inRoster: boolean,
    matchedShift: any,
  ): Promise<boolean> {
    if (inRoster) {
      return String(matchedShift?.employee_status ?? "").toUpperCase() === "EXTRA";
    }

    const dayStart = moment.utc(dateKey, "YYYY-MM-DD").startOf("day").toDate();
    const dayEnd = moment.utc(dateKey, "YYYY-MM-DD").endOf("day").toDate();

    const existing = await this.prisma.attendance_logs.findMany({
      where: {
        employee_id: employeeId,
        attendance_date: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true },
    });

    if (existing.length) {
      await this.prisma.attendance_logs.updateMany({
        where: { id: { in: existing.map((log) => log.id) } },
        data: { is_ot: true },
      });
    }

    return false;
  }

  async reloadRosterCache(
    startDate?: string,
    days = 7,
    employeeIds?: (string | number)[],
    authToken?: string,
  ) {
    const laravelBaseUrl = process.env.LARAVEL_URL?.replace(/\/+$/, "");
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    // A user-triggered reload (manual "reload roster" from the frontend) carries
    // the requesting admin's session token — use it as-is against the sanctum
    // route. A device-originated pull (check-in cache miss) has no session, so
    // it falls back to the internal/roster-schedule route gated by the shared
    // internal-service token instead (see VerifyInternalServiceToken).
    const useInternalToken = !authToken;

    if (!laravelBaseUrl) {
      return;
    }

    if (useInternalToken && !internalToken) {
      return;
    }

    const normalizedEmployeeIds = Array.from(
      new Set(
        (employeeIds ?? [])
          .map((employeeId) => String(employeeId).trim())
          .filter(Boolean),
      ),
    );

    const from = startDate
      ? this.startOfDay(new Date(startDate))
      : this.startOfDay(new Date());
    const to = this.endOfDay(this.addDays(from, Math.max(days, 1) - 1));
    const fromDate = this.formatDate(from);
    const toDate = this.formatDate(to);

    try {
      const response = await axios.get(
        `${laravelBaseUrl}/api/${useInternalToken ? "internal/roster-schedule" : "hrm/roster-schedule"}`,
        {
          params: this.buildRosterScheduleParams(
            fromDate,
            toDate,
            normalizedEmployeeIds,
          ),
          headers: useInternalToken
            ? { "X-Internal-Token": internalToken, Accept: "application/json" }
            : { Authorization: `Bearer ${authToken}`, Accept: "application/json" },
          timeout: Number(process.env.LARAVEL_TIMEOUT ?? 60000),
        },
      );
      const scheduleDays = Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      // Write fresh data first, THEN clean up old/legacy keys — never delete
      // before the replacement is in hand. Deleting first left a window where
      // a punch landing between the delete and the refetch saw no roster at
      // all for that date and silently fell back to the "unrostered" path,
      // even though a roster genuinely existed (this was worse whenever the
      // fetch itself failed below: the delete had already run, and the
      // swallowed error meant the cache stayed empty indefinitely).
      for (const dayData of scheduleDays) {
        const dayKey = this.formatDate(dayData.day);
        const payload = {
          date: dayKey,
          data: dayData,
          generated_at: new Date().toISOString(),
        };

        await this.redis.setex(
          this.getRosterCacheKey(dayKey),
          7 * 24 * 60 * 60,
          JSON.stringify(payload),
        );
      }

      await this.invalidateLegacyRosterKeys(
        scheduleDays
          .map((day: any) => this.formatDate(day.day))
          .filter(Boolean),
      );
    } catch (error: any) {
      this.logger.warn(
        `Roster cache reload failed, keeping previous cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async refreshRosterCacheWindow(authToken?: string) {
    const latestCachedDate = await this.getLatestRosterCacheDate();
    const today = this.startOfDay(new Date());

    if (!latestCachedDate) {
      await this.reloadRosterCache(
        this.formatDate(today),
        7,
        undefined,
        authToken,
      );
      return;
    }

    const diffDays = Math.floor(
      (today.getTime() - latestCachedDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (diffDays <= 1) {
      await this.reloadRosterCache(
        this.formatDate(today),
        7,
        undefined,
        authToken,
      );
      return;
    }

    await this.deleteRosterCacheBefore(today);
  }

  getDeviceSnapshot() {
    return [...this.deviceState].sort((left, right) =>
      (left.name ?? left.ip).localeCompare(right.name ?? right.ip),
    );
  }

  private handleDeviceStatus(state: {
    id: string;
    customId?: string | null;
    name?: string | null;
    ip: string;
    port: number;
    timeout: number;
    inport: number;
    status: "connecting" | "connected" | "disconnected" | "error";
    connected: boolean;
    connecting: boolean;
    lastCheckedAt: string;
    lastConnectedAt?: string;
    lastDisconnectedAt?: string;
    lastError?: string | null;
  }) {
    const index = this.deviceState.findIndex((item) => item.id === state.id);
    if (index >= 0) this.deviceState[index] = state;
    else this.deviceState.push(state);
    this.emitDeviceStatus(state);
    this.emitSnapshot();
  }

  private emitDeviceStatus(state: any) {
    socketService.emit("biometrics_device_status", state);
  }
  private emitSnapshot() {
    socketService.emit("biometrics_snapshot", {
      devices: this.getDeviceSnapshot(),
    });
  }
  private emitAttendance(payload: unknown) {
    socketService.emit("biometrics_attendance", payload);
  }

  // Removes only stray legacy-format keys (`biometrics:roster:<date>-*`) for the
  // given dates. Never touches the exact `biometrics:roster:<date>` key — that
  // one was just overwritten via setex in reloadRosterCache and must not be
  // deleted without a fresh replacement already in hand.
  private async invalidateLegacyRosterKeys(dates: string[]) {
    const uniqueDates = Array.from(new Set(dates.filter(Boolean)));
    if (!uniqueDates.length) return;

    for (const date of uniqueDates) {
      const legacyKeys = await this.redis.keys(
        `${this.getRosterCacheDayPattern(date)}-*`,
      );
      if (legacyKeys.length) {
        await this.redis.del(...legacyKeys);
      }
    }
  }

  private async invalidateRosterCacheByDates(dates: string[]) {
    const uniqueDates = Array.from(new Set(dates.filter(Boolean)));
    if (!uniqueDates.length) return;

    for (const date of uniqueDates) {
      const exactKey = this.getRosterCacheDayPattern(date);
      const legacyKeys = await this.redis.keys(
        `${this.getRosterCacheDayPattern(date)}-*`,
      );
      const keys = Array.from(new Set([exactKey, ...legacyKeys]));
      if (keys.length) {
        await this.redis.del(...keys);
      }
    }
  }

  private async deleteRosterCacheBefore(cutoff: Date) {
    const keys = await this.redis.keys("biometrics:roster:*");
    const cutoffTime = cutoff.getTime();

    const staleKeys = keys.filter((key) => {
      const match = key.match(/^biometrics:roster:(\d{4}-\d{2}-\d{2})(?:-|$)/);
      if (!match) return false;

      const keyDate = this.startOfDay(new Date(match[1]));
      return keyDate.getTime() < cutoffTime;
    });

    if (staleKeys.length) {
      await this.redis.del(...staleKeys);
    }
  }

  private async getLatestRosterCacheDate() {
    const keys = await this.redis.keys("biometrics:roster:*");
    let latest: Date | null = null;

    for (const key of keys) {
      const match = key.match(/^biometrics:roster:(\d{4}-\d{2}-\d{2})(?:-|$)/);
      if (!match) continue;

      const keyDate = this.startOfDay(new Date(match[1]));
      if (Number.isNaN(keyDate.getTime())) continue;

      if (!latest || keyDate.getTime() > latest.getTime()) {
        latest = keyDate;
      }
    }

    return latest;
  }

  private getRosterCacheKey(date: string) {
    return `biometrics:roster:${date}`;
  }
  private getRosterCacheDayPattern(date: string) {
    return `biometrics:roster:${date}`;
  }

  private buildRosterScheduleParams(
    startDate: string,
    endDate: string,
    employeeIds: string[],
  ) {
    const params = new URLSearchParams();
    params.set("start_date", startDate);
    params.set("end_date", endDate);
    params.set("all_employees", employeeIds.length ? "0" : "1");

    if (employeeIds.length) {
      for (const employeeId of employeeIds) {
        params.append("employee_ids[]", employeeId);
      }
    }

    return params;
  }

  private startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  private addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  // Live fallback used whenever the Redis roster snapshot is missing or doesn't
  // list this employee (cold cache, expired TTL, or a roster/override created
  // after the snapshot was cached) — queries the actual roster/override tables
  // instead of silently treating the employee as unrostered. Covers direct
  // employee assignment, group assignment, and same-day REPLACEMENT/EXTRA
  // overrides; SWAP source-shift resolution is not replicated here (that needs
  // the second_shift_id/group cross-check Laravel does) — a swapped-in
  // employee still falls through to the unfiltered day-shift match below.
  private async resolveLiveRosterShifts(
    employeeId: bigint,
    employeeGroupId: bigint | null,
    dateKey: string,
  ): Promise<
    {
      shift_id: bigint;
      start_time: Date;
      late_start_time: Date | null;
      early_start_time: Date | null;
      end_time: Date;
    }[]
  > {
    const dayStart = this.startOfDay(new Date(dateKey));
    const dayEnd = this.endOfDay(new Date(dateKey));

    try {
      // roster_has_groups is a multi-group roster's source of truth once saved via
      // the multi-group flow; a roster's own scalar group_id only ever holds the
      // first group, so an employee in a roster's 2nd+ group is invisible to a
      // group_id-only match (same bug class already fixed in the Laravel side —
      // EmployeeRosterService/EmployeeController). The relation is @ignore'd in the
      // Prisma schema, so query the pivot table directly instead of via include/some.
      const pivotRosterIds = employeeGroupId
        ? (
            await this.prisma.roster_has_groups.findMany({
              where: { group_id: employeeGroupId },
              select: { roster_id: true },
            })
          ).map((row) => row.roster_id)
        : [];

      const [rosterRows, overrideRows] = await Promise.all([
        this.prisma.rosters.findMany({
          where: {
            is_active: true,
            start_date: { lte: dayEnd },
            end_date: { gte: dayStart },
            OR: [
              { employee_id: employeeId },
              ...(employeeGroupId ? [{ group_id: employeeGroupId }] : []),
              ...(pivotRosterIds.length ? [{ id: { in: pivotRosterIds } }] : []),
            ],
          },
          include: { employee_shifts: true },
        }),
        this.prisma.shift_overrides.findMany({
          where: {
            is_active: true,
            replacement_employee_id: employeeId,
            date: { gte: dayStart, lte: dayEnd },
            type: { in: ["REPLACEMENT", "EXTRA"] },
          },
          include: {
            employee_shifts_shift_overrides_shift_idToemployee_shifts: true,
          },
        }),
      ]);

      const shifts = new Map<
        string,
        {
          shift_id: bigint;
          start_time: Date;
          late_start_time: Date | null;
          early_start_time: Date | null;
          end_time: Date;
        }
      >();

      for (const row of rosterRows) {
        if (!row.employee_shifts) continue;
        shifts.set(String(row.employee_shifts.id), {
          shift_id: row.employee_shifts.id,
          start_time: row.employee_shifts.start_time,
          late_start_time: row.employee_shifts.late_start_time,
          early_start_time: row.employee_shifts.early_start_time,
          end_time: row.employee_shifts.end_time,
        });
      }

      for (const row of overrideRows) {
        const shift = row.employee_shifts_shift_overrides_shift_idToemployee_shifts;
        if (!shift) continue;
        shifts.set(String(shift.id), {
          shift_id: shift.id,
          start_time: shift.start_time,
          late_start_time: shift.late_start_time,
          early_start_time: shift.early_start_time,
          end_time: shift.end_time,
        });
      }

      return Array.from(shifts.values());
    } catch (error) {
      this.logger.warn(
        `Live roster fallback query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private getRosterData(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.data ?? parsed;
    } catch {
      return null;
    }
  }
  private formatDate(date: Date | string) {
    return moment(date).format("YYYY-MM-DD");
  }
}
