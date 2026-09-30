<!DOCTYPE html>
<html lang="en">
<head>
    <title>Employee Report</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @page {
            size: A4 landscape;
            margin: 8mm;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 9px;
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
            table-layout: fixed;
        }

        td,
        th {
            padding: 4px;
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
            padding: 4px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .section-table th {
            font-weight: bold;
            background-color: #f0f0f0;
        }

        .section-table tr:nth-child(even) {
            background-color: #fafafa;
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
                    <div style="font-size:14px; font-weight:bold;">Employee Report</div>
                    <div style="font-size:11px;">
                        Total Employees: {{ count($employees) }} | Log period: {{ $dateRange['start'] ?? '-' }} to {{ $dateRange['end'] ?? '-' }}
                    </div>
                </td>
            </tr>
        </table>

        <table class="section-table">
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Total Salary</th>
                <th>Attendance</th>
                <th>Holiday</th>
                <th>Night Shift Attendances</th>
                <th>Total Bonus</th>
                <th>Overtime Bonus</th>
                <th>Side Bill</th>
                <th>Night Shift Bonus</th>
                <th>Attendance Bonus</th>
                <th>Payable Days</th>
                <th>Leave Balance</th>
                <th>Total Weekend</th>
            </tr>
            @foreach ($employees as $index => $employee)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $employee['name'] ?? '-' }}</td>
                    <td>{{ $employee['employee_no'] ?? '-' }}</td>
                    <td>{{ $employee['department'] ?? '-' }}</td>
                    <td>{{ $employee['designation'] ?? '-' }}</td>
                    <td>{{ $employee['status'] ?? '-' }}</td>
                    <td>{{ $employee['joined_date'] ?? '-' }}</td>
                    <td>{{ $employee['total_salary'] ?? '-' }}</td>
                    <td>{{ $employee['attendance'] ?? '-' }}</td>
                    <td>{{ $employee['holiday'] ?? '-' }}</td>
                    <td>{{ $employee['night_shift_attendance'] ?? '-' }}</td>
                    <td>{{ $employee['bonuses'] ?? '-' }}</td>
                    <td>{{ $employee['overtime_bonus'] ?? '-' }}</td>
                    <td>{{ $employee['side_bill'] ?? '-' }}</td>
                    <td>{{ $employee['night_shift_bonus'] ?? '-' }}</td>
                    <td>{{ $employee['attendance_bonus'] ?? '-' }}</td>
                    <td>{{ $employee['payable_days'] ?? '-' }}</td>
                    <td>{{ $employee['leave_balance'] ?? '-' }}</td>
                    <td>{{ $employee['total_weekend'] ?? '-' }}</td>
                </tr>
            @endforeach
        </table>
    </div>
</body>
</html>
