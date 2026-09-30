<!DOCTYPE html>
<html lang="en">
<head>
    <title>Payroll Report</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @page {
            size: A4 landscape;
            margin: 32.5mm 8mm 20mm 8mm;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 8px;
            color: #333;
            -webkit-font-smoothing: antialiased;
            margin: 0;
            padding: 0;
        }

        .pdf-header {
            position: fixed;
            top: -32.5mm;
            left: 0;
            right: 0;
            height: 32.5mm;
            padding-top: 4mm;
        }

        .pdf-footer {
            position: fixed;
            bottom: -20mm;
            left: 0;
            right: 0;
            height: 20mm;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        td,
        th {
            padding: 3px;
            text-align: left;
            vertical-align: top;
        }

        .header-table td {
            border: none;
            padding: 0;
        }

        .report-title {
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            margin-top: 3px;
        }

        .section-table {
            border: 1px solid #ccc;
        }

        .section-table th,
        .section-table td {
            border: 1px solid #ccc;
            padding: 3px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .section-table th {
            font-weight: bold;
            background-color: #f0f0f0;
        }

        .section-table tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        .signature-section {
            width: 100%;
        }

        .signature-section td {
            border: none;
            text-align: center;
            font-weight: bold;
            font-size: 9px;
            padding-top: 24px;
        }
    </style>
</head>
<body>
    <div class="pdf-header">
        <div style="text-align: center;">
            <img src="{{ public_path('images/btl_logo.png') }}" alt="Logo" style="width:70px;">
        </div>

        <table class="header-table" style="margin-top: 2px;">
            <tr>
                <td style="width: 25%; vertical-align: top;">
                    @if (!empty($totalDays))
                        <div style="font-size: 9px;">Total Days of The Month : {{ $totalDays }}</div>
                    @endif
                    @if (!empty($workingDays))
                        <div style="font-size: 9px; margin-top: 3px;">Working Day of The Month : {{ $workingDays }}</div>
                    @endif
                    @if (isset($whDays))
                        <div style="font-size: 9px; margin-top: 3px;">W/H Days of The Month : {{ $whDays }}</div>
                    @endif
                </td>
                <td style="width: 50%; text-align: center; vertical-align: top;">
                    <div style="font-weight: bold; font-size: 16px;">Bandhab Tex Limited</div>
                    <div style="font-size: 11px; margin-top: 2px;">
                        Head Office: Madhabdi Bazar, Madhabdi, Narsingdi. Factory: Goalnagar, Meherpara, Panchdona, Narsingdi.
                    </div>
                </td>
                <td style="width: 25%;"></td>
            </tr>
        </table>

        <div class="report-title">
            Salary Sheet of Employees for {{ $dateRange['start'] ?? '-' }} to {{ $dateRange['end'] ?? '-' }}@if (!empty($subtitle)) | {{ $subtitle }}@endif
        </div>
    </div>

    <div class="pdf-footer">
        <table class="signature-section">
            <tr>
                <td style="width: 16.66%;">Prepared By</td>
                <td style="width: 16.66%;">AGM</td>
                <td style="width: 16.66%;">DGM</td>
                <td style="width: 16.66%;">GM</td>
                <td style="width: 16.66%;">Director</td>
                <td style="width: 16.66%;">Managing Director</td>
            </tr>
        </table>
    </div>

    <table class="section-table">
        <thead>
            <tr>
                <th>#</th>
                <th>Name of Employee</th>
                <th>Designation</th>
                <th>Section</th>
                <th>Joining Date</th>
                <th>Card No.</th>
                <th>Basic Salary</th>
                <th>House Rent</th>
                <th>Medical Allow.</th>
                <th>Conv. Allow.</th>
                <th>Total Salary</th>
                <th>Off Days</th>
                <th>Leave Days</th>
                <th>Absent Days</th>
                <th>Actual Attendance</th>
                <th>In Total Attendance</th>
                <th>Salary Ded. for Absent</th>
                <th>Salary Ded. for Various Reason</th>
                <th>Night Bill</th>
                <th>Attendance Bonus</th>
                <th>Increment</th>
                <th>Stamp</th>
                <th>Net Salary</th>
                <th>Signature</th>
                <th>Remarks</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($payrolls as $index => $payroll)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $payroll['employee_name'] ?? '-' }}</td>
                    <td>{{ $payroll['designation'] ?? '-' }}</td>
                    <td>{{ $payroll['section'] ?? '-' }}</td>
                    <td>{{ $payroll['joining_date'] ?? '-' }}</td>
                    <td>{{ $payroll['card_no'] ?? '-' }}</td>
                    <td>{{ $payroll['basic_salary'] ?? '-' }}</td>
                    <td>{{ $payroll['house_rent'] ?? '-' }}</td>
                    <td>{{ $payroll['medical_allowance'] ?? '-' }}</td>
                    <td>{{ $payroll['conveyance_allowance'] ?? '-' }}</td>
                    <td>{{ $payroll['total_salary'] ?? '-' }}</td>
                    <td>{{ $payroll['off_days'] ?? '-' }}</td>
                    <td>{{ $payroll['leave_days'] ?? '-' }}</td>
                    <td>{{ $payroll['absent_days'] ?? '-' }}</td>
                    <td>{{ $payroll['actual_attendance'] ?? '-' }}</td>
                    <td>{{ $payroll['in_total_attendance'] ?? '-' }}</td>
                    <td>{{ $payroll['salary_ded_absent'] ?? '-' }}</td>
                    <td></td>
                    <td>{{ $payroll['night_bill'] ?? '-' }}</td>
                    <td>{{ $payroll['attendance_bonus'] ?? '-' }}</td>
                    <td></td>
                    <td></td>
                    <td>{{ $payroll['net_salary'] ?? '-' }}</td>
                    <td></td>
                    <td>{{ $payroll['remarks'] ?? '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
