import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  signal,
  computed,
  AfterViewInit,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { CommonService } from '@app/services/common-service/common.service';
import { Attendance } from '@app/modules/hr-management/shared/models/attendance';
import { firstValueFrom } from 'rxjs';
import { Employee } from '@app/shared/model/employee';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { DateFormatterService } from '@app/shared/utilities/date-format';
import FaceRecEnum from '@app/modules/hr-management/shared/enums/face-rec.enum';
import { Permissions } from '@app/shared/enums/permissions';
type Mode = 'enroll' | 'attendance' | 'today-list';

type AttendanceType = 'checkin' | 'checkout';

type Matched = {
  status: 'matched';
  employee_id: number;
  face_id?: string;
  timestamp: string;
  similarity?: number;
  employee?: any;
};

type Unknown = {
  status: 'unknown';
  timestamp: string;
  best_similarity?: number;
};

type MatchResponse = Matched | Unknown;

type EnrollResponse = {
  status: 'enrolled';
  employee_id: string;
  face_id: string;
  timestamp: string;
};

type MatchCandidate = {
  employee_id: number;
  timestamp: string;
  face_id?: string;
  similarity?: number;
};

type LastAttendance = {
  employee_id: number;
  type: AttendanceType;
  date: string;
  time: string;
  similarity?: number;
  face_id?: string;
  employee?: any;
};

type ValidateCheckinResponse = {
  matched: boolean;
  status: 'VALID' | 'LATE' | 'INVALID';
  shift?: any;
  check_in?: string;
  employee?: any;
};

type TodayAttendanceRow = {
  id: number;
  attendance_date: string;
  employee_id: number;
  check_in_time?: string;
  check_out_time?: string;
  employee?: any;
};

@Component({
  selector: 'app-face-recognition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './face-recognition.component.html',

  styleUrl: './face-recognition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaceRecognitionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  private faceApi = environment.faceApiBaseUrl.replace(/\/$/, '');
  mode = signal<Mode>('attendance');
  attendanceType = signal<AttendanceType>('checkin');
  busy = signal(false);
  cameraOn = signal(false);
  lastImageUrl = signal<string | null>(null);
  lastMatch = signal<MatchResponse | null>(null);
  lastEnroll = signal<EnrollResponse | null>(null);

  lastAttendance = signal<LastAttendance | null>(null);

  lastAttendanceWarning: string = '';
  lastAttendanceWarningSet: boolean = false;
  currentDateTime = signal(new Date());
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  todayAttendance = signal<TodayAttendanceRow[]>([]);
  todayAttendanceLoading = signal(false);
  employeeList: Employee[] = [];
  EmployeeName: string = '';
  Selectedemployee: Employee = new Employee();
  loading: boolean = false;
  public Permissions = Permissions;
  enrollForm = new FormGroup({
    employee_id: new FormControl<string>(
      this.Selectedemployee.id?.toString() || '',

      {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(64)],
      },
    ),
  });

  canEnroll = computed(
    () => this.enrollForm.valid && this.cameraOn() && !this.busy(),
  );

  canMatch = computed(() => this.cameraOn() && !this.busy());

  constructor(
    private http: HttpClient,
    private commonService: CommonService,
    public rolePermission: RolePermissionService,
    private dateFormate: DateFormatterService,
  ) { }

  ngOnInit() {
    this.GetEmployees();
    this.loadTodayAttendance();
    this.startClock();
  }

  ngAfterViewInit() { }

  GetEmployees() {
    this.loading = true;
    this.commonService
      .get('Employees?$orderby=id desc & $filter=is_active eq true&$top=1000', true)
      .subscribe({
        next: (response: any) => {
          this.employeeList = response.value;
          this.loading = false;
        },
        error: (err) => {
          console.error('Employee fetch Error', err);
          this.loading = false;
        },
      });
  }

  setEmployee(event: any) {
    const selectedItem = event.detail.item;

    this.Selectedemployee = new Employee().deserialize({
      id: selectedItem.id,
      first_name: selectedItem.text.split(' ')[0] || '',
      last_name: selectedItem.text.split(' ')[1] || '',
    });

    this.enrollForm.controls.employee_id.setValue(
      this.Selectedemployee.id?.toString() || '',
    );

    this.startCamera();
  }

  ngOnDestroy() {
    this.stopClock();
    this.stopCamera();
  }

  async startCamera() {
    this.lastImageUrl.set(null);

    try {
      if (this.cameraOn()) {
        this.stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      this.videoRef.nativeElement.srcObject = stream;
      await this.videoRef.nativeElement.play();
      this.cameraOn.set(true);
    } catch (e) {
      this.cameraOn.set(false);
    }
  }

  stopCamera() {
    const video = this.videoRef.nativeElement;
    const stream = video.srcObject as MediaStream | null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    this.cameraOn.set(false);
  }

  captureJpegBlob(quality = 0.92): Promise<Blob> {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Canvas not available');

    ctx.drawImage(video, 0, 0, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to capture frame'));
          const url = URL.createObjectURL(blob);
          const prev = this.lastImageUrl();
          if (prev) URL.revokeObjectURL(prev);
          this.lastImageUrl.set(url);
          resolve(blob);
        },

        'image/jpeg',

        quality,
      );
    });
  }

  // -------- API calls --------

  async enroll() {
    if (!this.canEnroll()) return;
    this.busy.set(true);
    this.lastEnroll.set(null);

    try {
      const employeeId = this.enrollForm.controls.employee_id.value.trim();
      const blob = await this.captureJpegBlob();
      const form = new FormData();
      form.append('image', blob, 'enroll.jpg');

      const url = `${this.faceApi}/enroll?employee_id=${encodeURIComponent(employeeId)}`;
      const res = await this.http.post<EnrollResponse>(url, form).toPromise();

      this.lastEnroll.set(res ?? null);

    } catch (err) {
      console.error(err);

    } finally {
      this.busy.set(false);
    }
  }

  async matchAndSendAttendance(options?: {
    suppressNoMatchToast?: boolean;

    autoStopCamera?: boolean;
  }) {
    if (!this.canMatch()) return;
    this.busy.set(true);
    this.lastMatch.set(null);
    this.resetAttendanceWarning();

    try {
      const data: any = await this.matchFace(options?.suppressNoMatchToast);
      if (!data) return;
      const type = this.attendanceType();
      const { date } = splitDateTime(data.timestamp);

      if (await this.isAttendanceBlocked(data.employee_id, date, type)) {
        this.setAttendanceWarning(
          `Already ${type} for employee ${data.employee?.first_name + ' ' + data.employee?.last_name} on ${this.formatAttendanceDate(
            date,
          )}.`,
        );
        return;
      }

      await this.submitAttendance(type, data);
    } catch (err) {
      console.error(err);
    } finally {
      if (options?.autoStopCamera) {
        this.stopCamera();
      }
      this.busy.set(false);
    }
  }

  private async matchFace(suppressNoMatchToast?: boolean) {
    const attempts = 3;
    const matches: MatchCandidate[] = [];

    for (let i = 0; i < attempts; i++) {
      const blob = await this.captureJpegBlob();
      const form = new FormData();
      form.append('image', blob, `frame_${i}.jpg`);
      const res = await this.http
        .post<MatchResponse>(`${this.faceApi}/match`, form)
        .toPromise();
      this.lastMatch.set(res ?? null);

      if (res && res.status === FaceRecEnum.MATCHED) {
        matches.push(res);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const data = this.pickConsensus(matches);
    if (!data) {
      return null;
    }
    return data;
  }

  private async submitAttendance(
    type: AttendanceType,
    data: MatchCandidate & { employee?: any },
  ) {
    const { date, time } = splitDateTime(data.timestamp);
    const validationTime = toHourMinute(data.timestamp);
    const attendance = new Attendance();
    attendance.attendance_date = date;
    attendance.employee_id = data.employee_id;
    let keepAttendanceWarning = false;

    if (type === FaceRecEnum.CHECKIN) {
      const checkinValidation = await this.validateCheckinShift(
        data.employee_id,
        date,
        validationTime,
      );
      // No blocking wall — always record the check-in against whichever shift was
      // resolved (mirrors node-server's biometrics attendance matching). A window
      // mismatch only downgrades the status to INVALID instead of refusing the
      // check-in outright.
      const status = checkinValidation?.status ?? 'INVALID';
      if (status === 'INVALID') {
        keepAttendanceWarning = true;
        const employeeName = data.employee
          ? `${data.employee.first_name ?? ''} ${data.employee.last_name ?? ''}`.trim()
          : `${data.employee_id}`;
        this.setAttendanceWarning(
          `Recorded as INVALID: employee ${employeeName} is not in shift for ${this.dateFormate.formatDate(
            date,
            true, // isCommaNeeded
            true, // isTimeNeeded
            true, // isAmPmNeeded
            true, // isTwelveHour
            false, // isUTCNeeded
          )}`,
        );
      }

      attendance.status = status;
      attendance.shift_id = checkinValidation?.shift?.id;
      attendance.check_in_time = data.timestamp;
      attendance.check_out_time = '';

      await firstValueFrom(
        this.commonService.post('AttendanceLogs', attendance.toOdata(), true),
      );
    } else if (type === FaceRecEnum.CHECKOUT) {
      const attendanceId = await this.getLatestAttendanceId(
        data.employee_id,
        date,
      );
      if (!attendanceId) {
        return;
      }
      attendance.id = attendanceId;
      attendance.check_out_time = data.timestamp;
      attendance.check_in_time = '';

      await firstValueFrom(
        this.commonService.put(
          `AttendanceLogs(${attendanceId})`,
          attendance.toOdata(),
          true,
        ),
      );
    }

    this.lastAttendance.set({
      employee_id: data.employee_id,
      type,
      date,
      time,
      similarity: data.similarity,
      face_id: data.face_id,
      employee: data.employee,
    });
    if (!keepAttendanceWarning) {
      this.resetAttendanceWarning();
    }
    this.loadTodayAttendance();
  }

  private async getLatestAttendanceId(employeeId: number, date: string) {
    const query =
      `AttendanceLogs?$filter=employee_id eq ${employeeId} and attendance_date eq '${date}'` +
      `&$orderby=id desc&$top=1`;

    const res: any = await firstValueFrom(this.commonService.get(query, true));
    return res?.value?.[0]?.id ?? null;
  }

  private pickConsensus(
    matches: MatchCandidate[],
  ) {
    if (matches.length === 0) return null;
    const counts = new Map<number, number>();
    for (const m of matches)
      counts.set(m.employee_id, (counts.get(m.employee_id) ?? 0) + 1);
    let bestId: number | null = null;
    let bestCount = 0;
    for (const [id, c] of counts.entries()) {
      if (c > bestCount) {
        bestCount = c;
        bestId = id;
      }
    }
    if (bestId === null || bestCount < 2) return null;
    return matches.find((m) => m.employee_id === bestId) ?? null;
  }

  // -------- UI helpers --------

  setMode(m: Mode) {
    this.mode.set(m);
    this.lastMatch.set(null);
    this.lastEnroll.set(null);
    if (m === 'today-list') {
      this.loadTodayAttendance();
    }
  }

  setAttendanceType(type: AttendanceType) {
    this.busy.set(false);
    this.attendanceType.set(type);
  }

  async onCheckInOut(type: AttendanceType) {
    this.lastAttendanceWarningSet = false;
    this.lastAttendance.set(null);
    if (this.mode() !== 'attendance') {
      this.mode.set('attendance');
    }
    this.attendanceType.set(type);

    if (!this.cameraOn()) {
      await this.startCamera();
    }

    setTimeout(async () => {
      await this.matchAndSendAttendance({ autoStopCamera: true });
    }, 2000);
  }

  private async isAttendanceBlocked(
    employeeId: number,
    date: string,
    type: AttendanceType,
  ) {
    const timeField = type === 'checkin' ? 'check_in_time' : 'check_out_time';
    const query =
      `AttendanceLogs?$filter=employee_id eq ${employeeId} and attendance_date eq '${date}'` +
      ` and ${timeField} ne null and ${timeField} ne ''&$top=1`;
    try {
      const res: any = await firstValueFrom(
        this.commonService.get(query, true),
      );
      return (res?.value?.length ?? 0) > 0;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  private async validateCheckinShift(
    employeeId: number,
    attendanceDate: string,
    time: string,
  ): Promise<ValidateCheckinResponse | null> {
    try {
      const res: any = await firstValueFrom(
        this.commonService.get(
          `hrm/employees/${employeeId}/validate-checkin?date=${attendanceDate}&time=${time}`,
          false,
        ),
      );
      return {
        matched: !!res?.matched,
        status: res?.status ?? 'INVALID',
        shift: res?.shift,
        check_in: res?.check_in,
        employee: res?.employee,
      };
    } catch (err) {
      console.error('validate-checkin error', err);
      return null;
    }
  }

  private setAttendanceWarning(message: string) {
    this.lastAttendanceWarningSet = true;
    this.lastAttendanceWarning = message;
  }

  private resetAttendanceWarning() {
    this.lastAttendanceWarningSet = false;
    this.lastAttendanceWarning = '';
  }

  private formatAttendanceDate(date: string) {
    return this.dateFormate.formatDate(
      date,
      true, // isCommaNeeded
      false, // isTimeNeeded
      false, // isAmPmNeeded
      false, // isTwelveHour
      false, // isUTCNeeded
    );
  }

  async loadTodayAttendance() {
    this.todayAttendanceLoading.set(true);
    const today = getLocalDateString();
    const query =
      `AttendanceLogs?$filter=attendance_date eq '${today}'` +
      `&$expand=employee($expand=group),shift&$orderby=id desc`;
    try {
      const res: any = await firstValueFrom(this.commonService.get(query, true));
      this.todayAttendance.set(res?.value ?? []);
    } catch (err) {
      console.error('today attendance load error', err);
      this.todayAttendance.set([]);
    } finally {
      this.todayAttendanceLoading.set(false);
    }
  }

  getAttendanceGroup(item: TodayAttendanceRow) {
    return (
      item?.employee?.group?.name ??
      item?.employee?.group_name ??
      item?.employee?.group ??
      item?.employee?.department?.name ??
      '-'
    );
  }

  private startClock() {
    this.stopClock();
    this.clockTimer = setInterval(() => {
      this.currentDateTime.set(new Date());
    }, 1000);
  }

  private stopClock() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }
}

function splitDateTime(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');

  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}:${ss}` };
}

function toHourMinute(iso: string) {
  const dt = new Date(iso);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

function getLocalDateString() {
  const dt = new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
