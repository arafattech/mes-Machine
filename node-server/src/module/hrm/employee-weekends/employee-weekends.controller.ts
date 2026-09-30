import { Body, Controller, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@prisma/prisma.service';
import { EmployeeWeekendsService } from '@module/hrm/employee-weekends/employee-weekends.service';

@Controller()
export class EmployeeWeekendsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeWeekendsService: EmployeeWeekendsService,
  ) {}

  /**
   * Queues the industrial-calendar bulk apply and returns immediately — the
   * actual sync runs in the background and reports progress over the socket
   * as `hrm-bulk-weekends:progress` (see EmployeeWeekendsService for why).
   */
  @Post('bulk')
  async bulkStore(
    @Body()
    body: {
      all_active?: boolean;
      employee_ids?: number[];
      data?: any[];
      year?: number;
    },
  ) {
    const year = body.year ?? new Date().getFullYear();

    const employeeIds = body.all_active
      ? (await this.prisma.employees.findMany({ where: { is_active: true }, select: { id: true } })).map((e) =>
          Number(e.id),
        )
      : (body.employee_ids ?? []);

    if (employeeIds.length === 0) {
      return { success: false, message: 'No employees provided.' };
    }

    const weekends = (body.data ?? []).filter((w) => (w.type ?? 'WEEKEND') !== 'LEAVE');

    const jobId = randomUUID();
    void this.employeeWeekendsService.runBulkSync(jobId, employeeIds, weekends, year);

    return {
      success: true,
      queued: true,
      job_id: jobId,
      message: 'Bulk weekends sync queued — progress will arrive in real time.',
    };
  }
}
