<!DOCTYPE html>
<html lang="en">
<head>
    <title>Employee Log</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px;
            color: #333;
            -webkit-font-smoothing: antialiased;
            margin: 0;
            padding: 0;
        }

        .log-container {
            width: 100%;
            border: 1px solid #000;
            padding: 5px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: avoid;
        }

        td,
        th {
            padding: 5px;
            text-align: left;
            vertical-align: top;
        }

        .header-table td {
            border: none;
            padding: 0;
        }

        .section-table {
            margin-top: 10px;
            border: 1px solid #ccc;
        }

        .section-table th,
        .section-table td {
            border: 1px solid #ccc;
            padding: 5px;
        }

        .section-table th {
            font-weight: bold;
            background-color: #f0f0f0;
            width: 40%;
        }

        .summary-row th,
        .summary-row td {
            font-weight: bold;
            background-color: #e9ecef;
        }

        .muted {
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="log-container">
        <table class="header-table">
            <tr>
                <td style="width: 30%;">
                    <img src="{{ public_path('images/btl_logo.png') }}" alt="Logo" style="width:100px;">
                </td>
                <td style="text-align:right; vertical-align:middle;">
                    <div style="font-weight:bold; font-size:16px;">Bandhab Tex Limited</div>
                    <div style="font-size:14px; font-weight:bold;">Employee Log</div>
                    <div style="font-size:12px;">
                        {{ $employee['name'] ?? 'Employee' }} | {{ $employee['employee_no'] ?? '-' }}
                    </div>
                    <div style="font-size:12px;">
                        Log period: {{ $dateRange['start'] ?? '-' }} to {{ $dateRange['end'] ?? '-' }}
                    </div>
                </td>
            </tr>
        </table>

        <table class="section-table">
            <tr class="summary-row">
                <th colspan="2">Employee Overview</th>
            </tr>
            <tr>
                <th>Name</th>
                <td>{{ $employee['name'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Employee ID</th>
                <td>{{ $employee['employee_no'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Department</th>
                <td>{{ $employee['department'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Designation</th>
                <td>{{ $employee['designation'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Supervisor</th>
                <td>{{ $employee['supervisor'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Status</th>
                <td>{{ $employee['status'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Joined Date</th>
                <td>{{ $employee['joined_date'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Email</th>
                <td>{{ $employee['email'] ?? '-' }}</td>
            </tr>
            <tr>
                <th>Phone</th>
                <td>{{ $employee['phone'] ?? '-' }}</td>
            </tr>
        </table>

        <table class="section-table">
            <tr class="summary-row">
                <th colspan="2">Billing Summary</th>
            </tr>
            <tr>
                <th>Total Salary</th>
                <td>{{ data_get($payroll, 'employeeSalary.total_salary', '-') }}</td>
            </tr>
            <tr>
                <th>Attendance</th>
                <td>{{ data_get($payroll, 'employeeAttendance.totalAttendenceInMonth', '-') }}</td>
            </tr>
            <tr>
                <th>Holiday</th>
                <td>{{ data_get($payroll, 'employeeAttendance.holiday', '-') }}</td>
            </tr>
            <tr>
                <th>Night Shift Attendances</th>
                <td>{{ data_get($payroll, 'employeeAttendance.nightShiftAttendances', '-') }}</td>
            </tr>
            <tr>
                <th>Total Bonus</th>
                <td>{{ data_get($payroll, 'bonuses', '-') }}</td>
            </tr>
            <tr>
                <th>Overtime Bonus</th>
                <td>{{ data_get($payroll, 'overtime', '-') }}</td>
            </tr>
            <tr>
                <th>Side Bill</th>
                <td>{{ data_get($payroll, 'sideBill', '-') }}</td>
            </tr>
            <tr>
                <th>Night Shift Bonus</th>
                <td>{{ data_get($payroll, 'employeeBonuses.nightShiftAttendenceBonus', '-') }}</td>
            </tr>
            <tr>
                <th>Attendance Bonus</th>
                <td>{{ data_get($payroll, 'employeeBonuses.attendenceBonuses', '-') }}</td>
            </tr>
            <tr>
                <th>Payable Days</th>
                <td>{{ data_get($payroll, 'total_payable_days', '-') }}</td>
            </tr>
            <tr>
                <th>Leave Balance</th>
                <td>{{ data_get($payroll, 'leaveStatus.leaveBalance', '-') }}</td>
            </tr>
            <tr>
                <th>Total Weekend</th>
                <td>{{ data_get($payroll, 'total_weekend', '-') }}</td>
            </tr>
        </table>

        <table class="section-table">
            <tr class="summary-row">
                <th colspan="2">Leave Status</th>
            </tr>
            <tr>
                <th>Leave Balance</th>
                <td>{{ data_get($leaveStatus, 'leaveBalance', '-') }}</td>
            </tr>
            <tr>
                <th>Leave in Year</th>
                <td>{{ collect(data_get($leaveStatus, 'leaveInYear', []))->sum('total') ?: 0 }}</td>
            </tr>
            <tr>
                <th>Leave in Month</th>
                <td>{{ collect(data_get($leaveStatus, 'leaveInMonth', []))->sum('total') ?: 0 }}</td>
            </tr>
            <tr>
                <th>Medical Leave</th>
                <td>{{ data_get(collect(data_get($leaveStatus, 'leaveTypes', []))->firstWhere('name', 'Medical Leave'), 'days', '-') }}</td>
            </tr>
            <tr>
                <th>Casual Leave</th>
                <td>{{ data_get(collect(data_get($leaveStatus, 'leaveTypes', []))->firstWhere('name', 'Casual Leave'), 'days', '-') }}</td>
            </tr>
        </table>

        <div class="spacer"></div>

    </div>
</body>
</html>
