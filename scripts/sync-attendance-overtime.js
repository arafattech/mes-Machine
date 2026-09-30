const axios = require('axios');

const BASE_URL = 'https://btl.hybri.tech/Backend/odata';
const TOKEN =
  'Bearer 342|gb1jY08mnoMxmGQmVim8jSz89lTiRMKUH4hxxIeTbdef0bf5';

const headers = {
  Authorization: TOKEN,
  'Content-Type': 'application/json',
};

function timeOfDayMinutes(dateTime) {
  const d = new Date(dateTime);
  return d.getHours() * 60 + d.getMinutes();
}

// shift.start_time/end_time are stored as full datetimes but only the
// time-of-day part matters; overnight shifts (end <= start) roll to next day.
function shiftDurationMinutes(shift) {
  const start = timeOfDayMinutes(shift.start_time);
  let end = timeOfDayMinutes(shift.end_time);
  if (end <= start) {
    end += 24 * 60;
  }
  return end - start;
}

// Finds the shift whose start/end window contains the check-in time.
function matchShiftForCheckIn(checkInTime, shifts) {
  const now = timeOfDayMinutes(checkInTime);

  return shifts.find((shift) => {
    const start = timeOfDayMinutes(shift.start_time);
    const end = timeOfDayMinutes(shift.end_time);

    if (start <= end) {
      return now >= start && now <= end;
    }

    // overnight shift
    return now >= start || now <= end;
  });
}

function workedMinutes(checkIn, checkOut) {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round(diffMs / 60000);
}

async function fetchActiveShifts() {
  const { data } = await axios.get(
    `${BASE_URL}/EmployeeShifts?$filter=is_active eq true`,
    { headers }
  );
  return data.value || [];
}

async function hasNightShiftBonus(attendanceLogId) {
  const { data } = await axios.get(
    `${BASE_URL}/EmployeeBonuses?$filter=attendance_log_id eq ${attendanceLogId} and bonus_type eq 'NIGHTSHIFT'`,
    { headers }
  );
  return (data.value || []).length > 0;
}

async function createNightShiftBonus(attendance, shift) {
  const employee = attendance.employee || {};

  await axios.post(
    `${BASE_URL}/EmployeeBonuses`,
    {
      emp_id: attendance.employee_id,
      shift_id: shift.id,
      attendance_log_id: attendance.id,
      bonus_type: 'NIGHTSHIFT',
      bonus_type_id: null,
      amount: 20,
      calculation_type: 'FIXED',
      overtime_minutes: null,
      bonus_config_amount: null,
      group_id: employee.group_id ?? null,
      department_id: employee.department_id ?? null,
      attendance_date: attendance.attendance_date,
      description: null,
      source_type: null,
      remarks: null,
      status: 'UNPAID',
    },
    { headers }
  );

  console.log(`Attendance ${attendance.id}: Created NIGHTSHIFT bonus`);
}

async function syncAttendanceOvertime() {
  let skip = 0;
  const top = 40;

  console.log('Starting attendance overtime sync...');

  const shifts = await fetchActiveShifts();
  console.log(`Loaded ${shifts.length} active shifts`);

  while (true) {
    const { data } = await axios.get(
      `${BASE_URL}/AttendanceLogs?$expand=employee&$top=${top}&$skip=${skip}`,
      { headers }
    );

    const records = data.value || [];

    console.log(`Fetched ${records.length} records (skip: ${skip})`);

    if (records.length === 0) {
      break;
    }

    for (const attendance of records) {
      try {
        if (!attendance.check_in_time || !attendance.check_out_time) {
          console.log(`Attendance ${attendance.id}: Missing check-in/out`);
          continue;
        }

        const matchedShift = matchShiftForCheckIn(
          attendance.check_in_time,
          shifts
        );

        if (!matchedShift) {
          console.log(`Attendance ${attendance.id}: No matching shift`);
          continue;
        }

        const shiftMinutes = shiftDurationMinutes(matchedShift);
        const attendedMinutes = workedMinutes(
          attendance.check_in_time,
          attendance.check_out_time
        );

        const overtimeMinutes = Math.max(0, attendedMinutes - shiftMinutes);

        const shiftUnchanged = attendance.shift_id === matchedShift.id;
        const overtimeUnchanged =
          (attendance.overtime_minutes ?? 0) === overtimeMinutes;

        if (!shiftUnchanged || !overtimeUnchanged) {
          await axios.patch(
            `${BASE_URL}/AttendanceLogs(${attendance.id})`,
            {
              shift_id: matchedShift.id,
              overtime_minutes: overtimeMinutes,
            },
            { headers }
          );

          console.log(
            `Attendance ${attendance.id}: Updated shift_id -> ${matchedShift.id}, overtime_minutes -> ${overtimeMinutes}`
          );
        } else {
          console.log(`Attendance ${attendance.id}: Already synced`);
        }

        if (matchedShift.is_night) {
          const alreadyHasBonus = await hasNightShiftBonus(attendance.id);
          if (!alreadyHasBonus) {
            await createNightShiftBonus(attendance, matchedShift);
          }
        }
      } catch (err) {
        console.error(
          `Attendance ${attendance.id}: Failed`,
          err.response?.data || err.message
        );
      }
    }

    skip += records.length;
  }

  console.log('Attendance overtime sync completed.');
}

syncAttendanceOvertime().catch((err) => {
  console.error('Sync failed:', err.response?.data || err.message);
});
