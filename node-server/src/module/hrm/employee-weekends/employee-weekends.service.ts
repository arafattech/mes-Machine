import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { socketService } from 'config/socket/socket.config';

const EMPLOYEE_CHUNK_SIZE = 200;
// Rows per INSERT (10 columns/row) — keeps well under MySQL's ~65535
// placeholder limit regardless of how many holiday dates are in the payload.
const ROW_CHUNK_SIZE = 500;
const PROGRESS_EVENT = 'hrm-bulk-weekends:progress';

interface WeekendInput {
  start_date: string;
  type?: string;
  type_id?: number | string | null;
  bonus_mode?: string | null;
  bonus_amount?: number | string | null;
  status?: string | null;
}

/**
 * The industrial-calendar bulk apply — was a Laravel queued job talking to
 * node-server over a Redis pub/sub relay (see git history for
 * SyncBulkEmployeeWeekendsJob) so the browser could get live progress
 * without blocking on one giant HTTP request. Moved here entirely: since the
 * work and the Socket.IO server it needs to report through now live in the
 * same process, there's no cross-service relay to maintain — just run the
 * sync in the background (fire-and-forget from the controller) and emit
 * progress directly.
 *
 * Chunks by employee (not by row) so each INSERT stays well under MySQL's
 * placeholder limit — the original inline Laravel version tried one upsert
 * for every employee × date at once and hit "Prepared statement contains too
 * many placeholders" on any reasonably large "apply to all active" run.
 */
@Injectable()
export class EmployeeWeekendsService {
  private readonly logger = new Logger(EmployeeWeekendsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runBulkSync(
    jobId: string,
    employeeIds: number[],
    weekends: WeekendInput[],
    year: number,
  ): Promise<void> {
    this.publish(jobId, 'processing', 0, employeeIds.length);

    const payloadTypes = [...new Set(weekends.map((w) => w.type).filter((t): t is string => !!t))];
    const payloadDates = weekends.map((w) => new Date(w.start_date));
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    try {
      let processed = 0;
      for (let i = 0; i < employeeIds.length; i += EMPLOYEE_CHUNK_SIZE) {
        const chunk = employeeIds.slice(i, i + EMPLOYEE_CHUNK_SIZE);

        await this.prisma.$transaction(async (tx) => {
          await tx.employee_weekends.deleteMany({
            where: {
              employee_id: { in: chunk.map(BigInt) },
              AND: [
                { weekend_date: { gte: yearStart, lte: yearEnd } },
                ...(payloadDates.length ? [{ weekend_date: { notIn: payloadDates } }] : []),
              ],
              ...(payloadTypes.length ? { type: { in: payloadTypes } } : {}),
            },
          });

          if (weekends.length === 0) return;

          const now = new Date();
          const rows = chunk.flatMap((employeeId) =>
            weekends.map((w) => Prisma.sql`(
              ${BigInt(employeeId)}, ${new Date(w.start_date)}, ${w.type ?? 'WEEKEND'},
              ${w.type_id ? BigInt(w.type_id) : null}, ${w.bonus_mode ?? null}, ${w.bonus_amount ?? null},
              ${w.status ?? 'APPROVED'}, ${true}, ${now}, ${now}
            )`),
          );

          // employeeIds.length alone doesn't bound the placeholder count —
          // it's (employees in this chunk) × (weekends) × 10 columns that
          // matters, and a large industrial calendar (many holiday rows) can
          // blow past MySQL's ~65535 placeholder limit even at a modest
          // employee chunk size. Sub-chunk the actual VALUES rows instead so
          // this scales with either dimension.
          for (let r = 0; r < rows.length; r += ROW_CHUNK_SIZE) {
            const rowBatch = rows.slice(r, r + ROW_CHUNK_SIZE);
            await tx.$executeRaw`
              INSERT INTO employee_weekends
                (employee_id, weekend_date, type, type_id, bonus_mode, bonus_amount, status, is_industrial, created_at, updated_at)
              VALUES ${Prisma.join(rowBatch)}
              ON DUPLICATE KEY UPDATE
                type_id = VALUES(type_id),
                bonus_mode = VALUES(bonus_mode),
                bonus_amount = VALUES(bonus_amount),
                status = VALUES(status),
                is_industrial = VALUES(is_industrial),
                updated_at = VALUES(updated_at)
            `;
          }
        });

        processed += chunk.length;
        this.publish(jobId, 'processing', processed, employeeIds.length);
      }

      this.publish(jobId, 'completed', employeeIds.length, employeeIds.length);
    } catch (err: any) {
      this.logger.error(`Bulk weekends sync failed (job ${jobId})`, err?.stack);
      this.publish(jobId, 'failed', 0, employeeIds.length, 'Failed to sync bulk employee weekends.');
    }
  }

  private publish(jobId: string, status: string, processed: number, total: number, message?: string): void {
    socketService.emit(PROGRESS_EVENT, { job_id: jobId, status, processed, total, message });
  }
}
