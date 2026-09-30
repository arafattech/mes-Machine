import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { socketService } from '../../../config/socket/socket.config';

export interface EmployeeImportJobData {
  jobId: string;
  rows: any[];
  token: string | null;
}

// Cap on how many employees are processed per DB transaction / progress tick.
// One giant $transaction over the whole file (previously thousands of statements
// in one interactive transaction) is what drove the CPU/RAM spikes in production —
// small chunked transactions keep each unit of work bounded and let the event loop
// breathe between chunks.
const IMPORT_CHUNK_SIZE = 20;

const EMPLOYEE_CORE_UPDATE_FIELDS = [
  'first_name',
  'last_name',
  'gender',
  'nid',
  'religion',
  'present_address',
  'permanent_address',
  'emgerency_contact_person_name',
  'emgerency_contact_number',
  'emgerency_contact_relation',
  'supervisor_name',
  'date_of_birth',
  'blood_group',
  'marital_status',
  'joining_date',
  'role',
  'address',
  'contact_number',
  'email',
  'refered_by',
  'custom_id',
] as const;

const EMPLOYEE_CORE_DATE_FIELDS: readonly string[] = ['date_of_birth', 'joining_date'];

@Injectable()
export class EmployeeImportProcessorService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: any): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private toCleanString(value: any): string | null {
    if (value === null || value === undefined) return null;

    const text = String(value).trim();
    if (!text) return null;

    const lower = text.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;

    return text;
  }

  private toCleanNumber(value: any): number | null {
    const text = this.toCleanString(value);
    if (!text) return null;

    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private excelValueToDate(excelValue: any): Date | null {
    if (excelValue === null || excelValue === undefined || excelValue === '') return null;

    if (typeof excelValue === 'number') {
      const parsedDate = XLSX.SSF.parse_date_code(excelValue);
      if (!parsedDate?.y || !parsedDate?.m || !parsedDate?.d) return null;

      const iso = `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`;
      return new Date(iso);
    }

    const date = new Date(excelValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private calculateSalaryParts(totalSalaryInput: any) {
    const total_salary = this.toNumber(totalSalaryInput);
    const basic = Math.max(0, total_salary * 0.5);
    const house_rent = Math.max(0, total_salary * 0.3);
    const medical_allowance = 750;
    const transport_allowance = 400;

    const other_allowance =
      total_salary - (basic + house_rent + medical_allowance + transport_allowance);

    return {
      total_salary,
      basic,
      house_rent,
      medical_allowance,
      transport_allowance,
      other_allowance,
    };
  }

  private toLookupKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private getUniqueStringValues(values: Array<string | null | undefined>): string[] {
    const lookup = Object.create(null) as Record<string, boolean>;
    const uniqueValues: string[] = [];

    values.forEach((value) => {
      const cleanedValue = this.toCleanString(value);
      if (!cleanedValue || lookup[cleanedValue]) return;
      lookup[cleanedValue] = true;
      uniqueValues.push(cleanedValue);
    });

    return uniqueValues;
  }

  private getUniqueNumberValues(values: Array<number | null | undefined>): number[] {
    const lookup = Object.create(null) as Record<number, boolean>;
    const uniqueValues: number[] = [];

    values.forEach((value) => {
      if (value === null || value === undefined || !Number.isFinite(value) || lookup[value]) return;
      lookup[value] = true;
      uniqueValues.push(value);
    });

    return uniqueValues;
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const currentIndex = cursor++;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    });

    await Promise.all(runners);
    return results;
  }

  private buildLookup(values: string[]): Record<string, boolean> {
    const lookup = Object.create(null) as Record<string, boolean>;
    values.forEach((value) => {
      lookup[value] = true;
    });
    return lookup;
  }

  private normalizeEmployeeRow(excelRow: any) {
    const totalSalaryFromExcel = excelRow['total _salary'] ?? excelRow['total_salary'] ?? 0;
    const departmentName = this.toCleanString(excelRow.department ?? excelRow.departemnt);
    const designationName = this.toCleanString(excelRow.designation);
    const employeeTypeName = this.toCleanString(excelRow.employee_type ?? excelRow.employe_type);
    const sectionName = this.toCleanString(excelRow.section);
    const phoneNumber = this.toCleanString(
      excelRow.phone ??
        excelRow.contact_number ??
        excelRow.mobile ??
        excelRow.mobile_no ??
        excelRow['phone number'] ??
        excelRow['contact number'],
    );
    const employeeGroupName = this.toCleanString(
      excelRow.employee_group ??
        excelRow.employee_grouop ??
        excelRow['employee group'] ??
        excelRow['employee grouop'] ??
        excelRow['employee _shift'],
    );

    delete excelRow['employee _shift'];
    delete excelRow.employee_group;
    delete excelRow.employee_grouop;
    delete excelRow['employee group'];
    delete excelRow['employee grouop'];
    delete excelRow['joining_month'];
    delete excelRow['__EMPTY'];
    delete excelRow['total _salary'];
    delete excelRow['departemnt'];

    return {
      ...excelRow,
      is_active: true,
      employee_id: undefined,

      employee_no: this.toCleanNumber(excelRow.employee_id),
      nid: this.toCleanString(excelRow.nid),
      department: departmentName,
      designation: designationName,
      employee_type: employeeTypeName,
      section: sectionName,
      contact_number: phoneNumber,
      employee_group: employeeGroupName,
      total_salary: this.toNumber(totalSalaryFromExcel),

      joining_date: this.excelValueToDate(excelRow.joining_date),
      date_of_birth: this.excelValueToDate(excelRow.date_of_birth),
    };
  }

  // Synchronous, cheap: parse + validate only, so bad-file errors still surface as an
  // immediate HTTP 400 before anything is handed to the background job queue.
  parseExcelFile(file?: Express.Multer.File): any[] {
    if (!file) throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelRows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: null,
      raw: true,
    }) as any[];

    if (!excelRows.length) {
      throw new HttpException('Excel file is empty', HttpStatus.BAD_REQUEST);
    }

    const hasEmployeeIds = excelRows.some((row) => this.toCleanString(row.employee_id));
    if (!hasEmployeeIds) {
      throw new HttpException(
        'employee_id column is missing/empty (used as employee_no)',
        HttpStatus.BAD_REQUEST,
      );
    }

    return excelRows;
  }

  private emitProgress(
    jobId: string,
    processed: number,
    total: number,
    stage: string,
    extra: Record<string, any> = {},
  ): void {
    socketService.emit('employee-import:progress', {
      jobId,
      stage,
      processed,
      total,
      percentage: total ? Math.round((processed / total) * 100) : 100,
      ...extra,
    });
  }

  // Runs off the HTTP request, inside the BullMQ worker (see EmployeeImportQueueService).
  // Same logic as before, but the DB-write phase is chunked into small transactions
  // (IMPORT_CHUNK_SIZE employees each) instead of one transaction covering the whole
  // file — that single giant transaction is what caused the CPU/RAM spikes in production.
  async runImportJob(data: EmployeeImportJobData): Promise<void> {
    const { jobId, rows: excelRows, token } = data;
    try {
      const normalizedEmployees = excelRows.map((row) => this.normalizeEmployeeRow(row));
      const employeeNumbersFromFile = this.getUniqueNumberValues(
        normalizedEmployees.map((employee) => employee.employee_no),
      );
      const departmentNamesFromFile = this.getUniqueStringValues(
        normalizedEmployees.map((employee) => employee.department),
      );
      const designationNamesFromFile = this.getUniqueStringValues(
        normalizedEmployees.map((employee) => employee.designation),
      );
      const employeeTypeNamesFromFile = this.getUniqueStringValues(
        normalizedEmployees.map((employee) => employee.employee_type),
      );
      const sectionNamesFromFile = this.getUniqueStringValues(
        normalizedEmployees.map((employee) => employee.section),
      );
      const employeeGroupNamesFromFile = this.getUniqueStringValues(
        normalizedEmployees.map((employee) => employee.employee_group),
      );

      if (!employeeNumbersFromFile.length) {
        throw new HttpException(
          'employee_id column is missing/empty (used as employee_no)',
          HttpStatus.BAD_REQUEST,
        );
      }

      const existingDepartments = departmentNamesFromFile.length
        ? await this.prisma.departments.findMany({
            where: { name: { in: departmentNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const existingDepartmentLookup = this.buildLookup(
        existingDepartments.map((department) => this.toLookupKey(department.name)),
      );

      const departmentsToCreate = departmentNamesFromFile.filter(
        (departmentName) => !existingDepartmentLookup[this.toLookupKey(departmentName)],
      );

      if (departmentsToCreate.length) {
        await this.prisma.departments.createMany({
          data: departmentsToCreate.map((departmentName) => ({ name: departmentName })),
        });
      }

      const allDepartments = departmentNamesFromFile.length
        ? await this.prisma.departments.findMany({
            where: { name: { in: departmentNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const departmentIdByNameKey = new Map<string, bigint>();
      allDepartments.forEach((department) => {
        const key = this.toLookupKey(department.name);
        if (!departmentIdByNameKey.has(key)) {
          departmentIdByNameKey.set(key, department.id);
        }
      });

      const existingDesignations = designationNamesFromFile.length
        ? await this.prisma.designations.findMany({
            where: { name: { in: designationNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const existingDesignationLookup = this.buildLookup(
        existingDesignations.map((designation) => this.toLookupKey(designation.name)),
      );

      const designationsToCreate = designationNamesFromFile.filter(
        (designationName) => !existingDesignationLookup[this.toLookupKey(designationName)],
      );

      if (designationsToCreate.length) {
        await this.prisma.designations.createMany({
          data: designationsToCreate.map((designationName) => ({ name: designationName })),
        });
      }

      const allDesignations = designationNamesFromFile.length
        ? await this.prisma.designations.findMany({
            where: { name: { in: designationNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const designationIdByNameKey = new Map<string, bigint>();
      allDesignations.forEach((designation) => {
        const key = this.toLookupKey(designation.name);
        if (!designationIdByNameKey.has(key)) {
          designationIdByNameKey.set(key, designation.id);
        }
      });

      const existingEmployeeTypes = employeeTypeNamesFromFile.length
        ? await this.prisma.employee_types.findMany({
            where: { name: { in: employeeTypeNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const existingEmployeeTypeLookup = this.buildLookup(
        existingEmployeeTypes.map((employeeType) => this.toLookupKey(employeeType.name)),
      );

      const employeeTypesToCreate = employeeTypeNamesFromFile.filter(
        (employeeTypeName) => !existingEmployeeTypeLookup[this.toLookupKey(employeeTypeName)],
      );

      if (employeeTypesToCreate.length) {
        await this.prisma.employee_types.createMany({
          data: employeeTypesToCreate.map((employeeTypeName) => ({ name: employeeTypeName })),
        });
      }

      const allEmployeeTypes = employeeTypeNamesFromFile.length
        ? await this.prisma.employee_types.findMany({
            where: { name: { in: employeeTypeNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const employeeTypeIdByNameKey = new Map<string, bigint>();
      allEmployeeTypes.forEach((employeeType) => {
        const key = this.toLookupKey(employeeType.name);
        if (!employeeTypeIdByNameKey.has(key)) {
          employeeTypeIdByNameKey.set(key, employeeType.id);
        }
      });

      const existingSections = sectionNamesFromFile.length
        ? await this.prisma.employee_sections.findMany({
            where: { name: { in: sectionNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const existingSectionLookup = this.buildLookup(
        existingSections.map((section) => this.toLookupKey(section.name)),
      );

      const sectionsToCreate = sectionNamesFromFile.filter(
        (sectionName) => !existingSectionLookup[this.toLookupKey(sectionName)],
      );

      if (sectionsToCreate.length) {
        await this.prisma.employee_sections.createMany({
          data: sectionsToCreate.map((sectionName) => ({ name: sectionName })),
        });
      }

      const allSections = sectionNamesFromFile.length
        ? await this.prisma.employee_sections.findMany({
            where: { name: { in: sectionNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const sectionIdByNameKey = new Map<string, bigint>();
      allSections.forEach((section) => {
        const key = this.toLookupKey(section.name);
        if (!sectionIdByNameKey.has(key)) {
          sectionIdByNameKey.set(key, section.id);
        }
      });

      const allEmployeeGroups = employeeGroupNamesFromFile.length
        ? await this.prisma.employee_groups.findMany({
            where: { name: { in: employeeGroupNamesFromFile } },
            select: { id: true, name: true },
          })
        : [];

      const employeeGroupIdByNameKey = new Map<string, bigint>();
      allEmployeeGroups.forEach((group) => {
        const key = this.toLookupKey(group.name);
        if (!employeeGroupIdByNameKey.has(key)) {
          employeeGroupIdByNameKey.set(key, group.id);
        }
      });

      const existingEmployees = await this.prisma.employees.findMany({
        where: { employee_no: { in: employeeNumbersFromFile } },
        select: { employee_no: true },
      });

      const existingEmployeeNumberLookup = this.buildLookup(
        existingEmployees.map((employee) => String(employee.employee_no).trim()),
      );

      const employeesToInsert = normalizedEmployees
        .filter(
          (employee) =>
            employee.employee_no &&
            !existingEmployeeNumberLookup[String(employee.employee_no).trim()],
        )
        .map((employee) => {
          const {
            total_salary: _totalSalary,
            branch_name: _branchName,
            bank_name: _bankName,
            account_no: _accountNo,
            ['account_no.']: _accountNoWithDot,
            account_holder_name: _accountHolderName,
            swift_code: _swiftCode,
            employee_group: _employeeGroup,
            ...employeeData
          } = employee;
          const departmentName = this.toCleanString(employee.department);
          const departmentId = departmentName
            ? departmentIdByNameKey.get(this.toLookupKey(departmentName)) ?? null
            : null;
          const designationName = this.toCleanString(employee.designation);
          const designationId = designationName
            ? designationIdByNameKey.get(this.toLookupKey(designationName)) ?? null
            : null;
          const employeeTypeName = this.toCleanString(employee.employee_type);
          const employeeTypeId = employeeTypeName
            ? employeeTypeIdByNameKey.get(this.toLookupKey(employeeTypeName)) ?? null
            : null;
          const sectionName = this.toCleanString(employee.section);
          const sectionId = sectionName
            ? sectionIdByNameKey.get(this.toLookupKey(sectionName)) ?? null
            : null;
          const employeeGroupName = this.toCleanString(employee.employee_group);
          const employeeGroupId = employeeGroupName
            ? employeeGroupIdByNameKey.get(this.toLookupKey(employeeGroupName)) ?? null
            : null;

          return {
            ...employeeData,
            department: departmentName,
            department_id: departmentId,
            designation: designationName,
            designation_id: designationId,
            employee_type: employeeTypeName,
            employee_type_id: employeeTypeId,
            section: sectionName,
            employee_section_id: sectionId,
            group_id: employeeGroupId,
          };
        });

      const insertedEmployeesResult = employeesToInsert.length
        ? await this.prisma.employees.createMany({ data: employeesToInsert })
        : { count: 0 };

      const employeesForIdMap = await this.prisma.employees.findMany({
        where: { employee_no: { in: employeeNumbersFromFile } },
        select: { id: true, employee_no: true, user_id: true },
      });

      const employeeIdByEmployeeNo = new Map(
        employeesForIdMap.map((employee) => [String(employee.employee_no).trim(), employee.id]),
      );

      const employeeNumbersWithLinkedUser = this.buildLookup(
        employeesForIdMap
          .filter((employee) => employee.user_id)
          .map((employee) => String(employee.employee_no).trim()),
      );

      const employeeCoreUpdates = normalizedEmployees
        .filter(
          (employee) =>
            employee.employee_no &&
            existingEmployeeNumberLookup[String(employee.employee_no).trim()],
        )
        .map((employee) => {
          const employeeNo = String(employee.employee_no).trim();
          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          if (!employeeId) return null;

          const data: Record<string, any> = {};
          EMPLOYEE_CORE_UPDATE_FIELDS.forEach((field) => {
            const rawValue = (employee as Record<string, any>)[field];
            if (rawValue === undefined) return;

            if (EMPLOYEE_CORE_DATE_FIELDS.includes(field)) {
              if (rawValue instanceof Date || rawValue === null) data[field] = rawValue;
              return;
            }

            const isScalar =
              rawValue === null || ['string', 'number', 'boolean'].includes(typeof rawValue);
            if (!isScalar) return;

            const value = this.toCleanString(rawValue);
            if (field === 'first_name' && !value) return;
            data[field] = value;
          });

          return { employee_id: employeeId, data };
        })
        .filter(Boolean) as { employee_id: bigint; data: Record<string, any> }[];

      const salaryRows = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no ? String(employee.employee_no).trim() : null;
          if (!employeeNo) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          if (!employeeId) return null;

          return {
            employee_id: employeeId,
            ...this.calculateSalaryParts(employee.total_salary ?? 0),
          };
        })
        .filter(Boolean) as any[];

      const existingSalaryRows = salaryRows.length
        ? await this.prisma.employee_salaries.findMany({
            where: { employee_id: { in: salaryRows.map((row) => row.employee_id) } },
            select: { employee_id: true },
          })
        : [];

      const existingSalaryEmployeeIdLookup = this.buildLookup(
        existingSalaryRows.map((row) => String(row.employee_id)),
      );

      const salaryRowsToCreate = salaryRows.filter(
        (row) => !existingSalaryEmployeeIdLookup[String(row.employee_id)],
      );

      const salaryRowsToUpdate = salaryRows.filter(
        (row) => existingSalaryEmployeeIdLookup[String(row.employee_id)],
      );

      const employeeBankInfosToUpsert = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no ? String(employee.employee_no).trim() : null;
          if (!employeeNo) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          if (!employeeId) return null;

          return {
            employee_id: employeeId,
            bank_name: this.toCleanString(employee.bank_name),
            branch_name: this.toCleanString(employee.branch_name),
            account_number: this.toCleanString(employee['account_no.'] ?? employee.account_no),
            account_holder_name: this.toCleanString(employee.account_holder_name),
            swift_code: this.toCleanString(employee.swift_code),
          };
        })
        .filter(
          (info) =>
            info &&
            (info.bank_name ||
              info.branch_name ||
              info.account_number ||
              info.account_holder_name ||
              info.swift_code),
        )
        .filter(Boolean) as any[];

      const existingBankRows = employeeBankInfosToUpsert.length
        ? await this.prisma.employee_bank_infos.findMany({
            where: { employee_id: { in: employeeBankInfosToUpsert.map((row) => row.employee_id) } },
            select: { employee_id: true },
          })
        : [];

      const existingBankEmployeeIdLookup = this.buildLookup(
        existingBankRows.map((row) => String(row.employee_id)),
      );

      const bankRowsToCreate = employeeBankInfosToUpsert.filter(
        (row) => !existingBankEmployeeIdLookup[String(row.employee_id)],
      );

      const bankRowsToUpdate = employeeBankInfosToUpsert.filter(
        (row) => existingBankEmployeeIdLookup[String(row.employee_id)],
      );

      const departmentAssignments = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no?.toString().trim();
          const departmentName = this.toCleanString(employee.department);

          if (!employeeNo || !departmentName) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          const departmentId = departmentIdByNameKey.get(this.toLookupKey(departmentName));

          if (!employeeId || !departmentId) return null;

          return {
            employee_id: employeeId,
            department_id: departmentId,
            department: departmentName,
          };
        })
        .filter(Boolean) as {
        employee_id: bigint;
        department_id: bigint;
        department: string;
      }[];

      const designationAssignments = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no?.toString().trim();
          const designationName = this.toCleanString(employee.designation);

          if (!employeeNo || !designationName) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          const designationId = designationIdByNameKey.get(this.toLookupKey(designationName));

          if (!employeeId || !designationId) return null;

          return {
            employee_id: employeeId,
            designation_id: designationId,
            designation: designationName,
          };
        })
        .filter(Boolean) as {
        employee_id: bigint;
        designation_id: bigint;
        designation: string;
      }[];

      const employeeTypeAssignments = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no?.toString().trim();
          const employeeTypeName = this.toCleanString(employee.employee_type);

          if (!employeeNo || !employeeTypeName) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          const employeeTypeId = employeeTypeIdByNameKey.get(this.toLookupKey(employeeTypeName));

          if (!employeeId || !employeeTypeId) return null;

          return {
            employee_id: employeeId,
            employee_type_id: employeeTypeId,
            employee_type: employeeTypeName,
          };
        })
        .filter(Boolean) as {
        employee_id: bigint;
        employee_type_id: bigint;
        employee_type: string;
      }[];

      const sectionAssignments = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no?.toString().trim();
          const sectionName = this.toCleanString(employee.section);

          if (!employeeNo || !sectionName) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          const sectionId = sectionIdByNameKey.get(this.toLookupKey(sectionName));
          if (!employeeId || !sectionId) return null;

          return {
            employee_id: employeeId,
            employee_section_id: sectionId,
            section: sectionName,
          };
        })
        .filter(Boolean) as {
        employee_id: bigint;
        employee_section_id: bigint;
        section: string;
      }[];

      const employeeGroupAssignments = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no?.toString().trim();
          const groupName = this.toCleanString(employee.employee_group);

          if (!employeeNo || !groupName) return null;

          const employeeId = employeeIdByEmployeeNo.get(employeeNo);
          const groupId = employeeGroupIdByNameKey.get(this.toLookupKey(groupName));
          if (!employeeId || !groupId) return null;

          return {
            employee_id: employeeId,
            group_id: groupId,
          };
        })
        .filter(Boolean) as {
        employee_id: bigint;
        group_id: bigint;
      }[];

      // Chunked writes: one small $transaction per IMPORT_CHUNK_SIZE employees instead of
      // one giant transaction covering the whole file — bounds memory/CPU per unit of work
      // and yields the event loop between chunks, with a socket progress tick per chunk.
      const employeeIdsInOrder = normalizedEmployees
        .map((employee) => {
          const employeeNo = employee.employee_no?.toString().trim();
          return employeeNo ? employeeIdByEmployeeNo.get(employeeNo) : undefined;
        })
        .filter((id): id is bigint => Boolean(id));

      const totalForUpdatePhase = employeeIdsInOrder.length;
      let updatedSoFar = 0;

      for (let i = 0; i < employeeIdsInOrder.length; i += IMPORT_CHUNK_SIZE) {
        const chunkIds = new Set(employeeIdsInOrder.slice(i, i + IMPORT_CHUNK_SIZE));

        const chunkStatements = [
          ...employeeCoreUpdates
            .filter((update) => chunkIds.has(update.employee_id))
            .map((update) =>
              this.prisma.employees.updateMany({
                where: { id: update.employee_id },
                data: update.data,
              }),
            ),
          ...departmentAssignments
            .filter((assignment) => chunkIds.has(assignment.employee_id))
            .map((assignment) =>
              this.prisma.employees.updateMany({
                where: { id: assignment.employee_id },
                data: {
                  department_id: assignment.department_id,
                  department: assignment.department,
                },
              }),
            ),
          ...designationAssignments
            .filter((assignment) => chunkIds.has(assignment.employee_id))
            .map((assignment) =>
              this.prisma.employees.updateMany({
                where: { id: assignment.employee_id },
                data: {
                  designation_id: assignment.designation_id,
                  designation: assignment.designation,
                },
              }),
            ),
          ...employeeTypeAssignments
            .filter((assignment) => chunkIds.has(assignment.employee_id))
            .map((assignment) =>
              this.prisma.employees.updateMany({
                where: { id: assignment.employee_id },
                data: {
                  employee_type_id: assignment.employee_type_id,
                  employee_type: assignment.employee_type,
                },
              }),
            ),
          ...sectionAssignments
            .filter((assignment) => chunkIds.has(assignment.employee_id))
            .map((assignment) =>
              this.prisma.employees.updateMany({
                where: { id: assignment.employee_id },
                data: {
                  employee_section_id: assignment.employee_section_id,
                  section: assignment.section,
                },
              }),
            ),
          ...employeeGroupAssignments
            .filter((assignment) => chunkIds.has(assignment.employee_id))
            .map((assignment) =>
              this.prisma.employees.updateMany({
                where: { id: assignment.employee_id },
                data: {
                  group_id: assignment.group_id,
                },
              }),
            ),
          ...(salaryRowsToCreate.some((row) => chunkIds.has(row.employee_id))
            ? [
                this.prisma.employee_salaries.createMany({
                  data: salaryRowsToCreate.filter((row) => chunkIds.has(row.employee_id)),
                }),
              ]
            : []),
          ...salaryRowsToUpdate
            .filter((row) => chunkIds.has(row.employee_id))
            .map((row) =>
              this.prisma.employee_salaries.updateMany({
                where: { employee_id: row.employee_id },
                data: {
                  total_salary: row.total_salary,
                  basic: row.basic,
                  house_rent: row.house_rent,
                  medical_allowance: row.medical_allowance,
                  transport_allowance: row.transport_allowance,
                  other_allowance: row.other_allowance,
                },
              }),
            ),
          ...bankRowsToUpdate
            .filter((info) => chunkIds.has(info.employee_id))
            .map((info) =>
              this.prisma.employee_bank_infos.updateMany({
                where: { employee_id: info.employee_id },
                data: {
                  bank_name: info.bank_name,
                  branch_name: info.branch_name,
                  account_number: info.account_number,
                  account_holder_name: info.account_holder_name,
                  swift_code: info.swift_code,
                },
              }),
            ),
          ...(bankRowsToCreate.some((info) => chunkIds.has(info.employee_id))
            ? [
                this.prisma.employee_bank_infos.createMany({
                  data: bankRowsToCreate.filter((info) => chunkIds.has(info.employee_id)),
                }),
              ]
            : []),
        ];

        if (chunkStatements.length) {
          await this.prisma.$transaction(chunkStatements);
        }

        updatedSoFar += chunkIds.size;
        this.emitProgress(jobId, updatedSoFar, totalForUpdatePhase, 'updating');
      }

      const laravelBaseUrl = process.env.LARAVEL_URL;

      const employeesWithUserContact = normalizedEmployees.filter((employee: any) => {
        const email = this.toCleanString(employee.email);
        const phone = this.toCleanString(employee.phone ?? employee.contact_number);
        if (!email && !phone) return false;

        const employeeNo = employee.employee_no ? String(employee.employee_no).trim() : null;
        if (employeeNo && employeeNumbersWithLinkedUser[employeeNo]) return false;

        return true;
      });

      const USER_CREATE_CONCURRENCY = 5;
      let userProcessed = 0;
      const userResults = await this.runWithConcurrency(
        employeesWithUserContact,
        USER_CREATE_CONCURRENCY,
        async (employee: any) => {
          const reportProgress = () => {
            userProcessed += 1;
            this.emitProgress(jobId, userProcessed, employeesWithUserContact.length, 'creating-accounts');
          };
          if (!laravelBaseUrl) {
            reportProgress();
            return {
              email: this.toCleanString(employee.email),
              phone: this.toCleanString(employee.phone ?? employee.contact_number),
              ok: false,
              error: 'Missing LARAVEL_URL',
            };
          }
          const email = this.toCleanString(employee.email);
          const phone = this.toCleanString(employee.phone ?? employee.contact_number);
          const fullName =
            [employee.first_name, employee.last_name].filter(Boolean).join(' ') || email || phone;

          if (!token) {
            console.warn(
              'Import user creation is running without auth token for:',
              email || phone || employee.employee_no,
            );
          }

          try {
            const response = await axios.post(
              `${laravelBaseUrl}/api/add/user`,
              {
                userInfo: {
                  ...(email ? { email } : {}),
                  ...(phone ? { phone } : {}),
                  password: 'hr1234',
                  name: fullName,
                  is_active: true,
                },
                roles: [],
              },
              token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
            );

            const createdUserEmail = this.toCleanString(response.data?.data?.email);
            const createdUserPhone = this.toCleanString(response.data?.data?.phone);
            const createdUserId = response.data?.data?.id ?? null;

            if (createdUserId) {
              if (createdUserEmail) {
                await this.prisma.employees.update({
                  where: { email: createdUserEmail },
                  data: {
                    user_id: createdUserId,
                  },
                });
              } else if (createdUserPhone) {
                await this.prisma.employees.updateMany({
                  where: { contact_number: createdUserPhone },
                  data: {
                    user_id: createdUserId,
                  },
                });
              }
            }
            reportProgress();
            return {
              email,
              phone,
              ok: true,
              data: response.data,
            };
          } catch (error: any) {
            reportProgress();
            return {
              email: this.toCleanString(employee.email),
              phone: this.toCleanString(employee.phone ?? employee.contact_number),
              ok: false,
              error: error?.response?.data || error.message,
            };
          }
        },
      );

      const summary = {
        total_rows: normalizedEmployees.length,
        employee_new_inserted: insertedEmployeesResult.count,
        employee_existing_skipped: normalizedEmployees.length - employeesToInsert.length,
        employee_existing_updated: employeeCoreUpdates.length,
        salary_created: salaryRowsToCreate.length,
        salary_updated: salaryRowsToUpdate.length,
        bank_created: bankRowsToCreate.length,
        bank_updated: bankRowsToUpdate.length,
        department_created: departmentsToCreate.length,
        department_assigned: departmentAssignments.length,
        designation_created: designationsToCreate.length,
        designation_assigned: designationAssignments.length,
        employee_type_created: employeeTypesToCreate.length,
        employee_type_assigned: employeeTypeAssignments.length,
        section_created: sectionsToCreate.length,
        section_assigned: sectionAssignments.length,
        user_total: employeesWithUserContact.length,
        user_success: userResults.filter((result) => result.ok).length,
        user_failed: userResults.filter((result) => !result.ok).length,
      };

      socketService.emit('employee-import:completed', { jobId, summary });
    } catch (error: any) {
      console.error('Excel import job failed:', error);
      socketService.emit('employee-import:failed', { jobId, error: error.message });
      throw error;
    }
  }
}
