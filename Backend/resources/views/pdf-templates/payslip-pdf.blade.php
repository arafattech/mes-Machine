<!DOCTYPE html>
<html lang="en">
<head>
    <title>Payslip</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @page {
            size: A4 landscape;
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

        .payslip-container {
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
            padding: 6px;
            text-align: left;
            vertical-align: top;
        }

        .main-table>tbody>tr>td {
            width: 50%;
            padding: 8px;
            vertical-align: top;
        }

        .dashed-border-right {
            border-right: 2px dashed #000;
        }

        .header-table td {
            border: none;
            padding: 0;
        }

        .details-table {
            margin-top: 10px;
            border: 1px solid #ccc;
        }

        .details-table th,
        .details-table td {
            border: 1px solid #ccc;
            padding: 7px;
        }

        .details-table th {
            font-weight: bold;
            background-color: #f0f0f0;
            width: 40%;
        }

        .summary-row th,
        .summary-row td {
            font-weight: bold;
            background-color: #e9ecef;
        }

    </style>
</head>
<body>

    @php
    $payPeriodDisplay = 'N/A';
    if (isset($data['pay_period']) && preg_match('/^\\d{1,2}\\/\\d{4}$/', $data['pay_period'])) {
    try {
    // Handle cases like "9/2025" or "09/2025"
    $payPeriod = \Carbon\Carbon::createFromFormat('n/Y', $data['pay_period']);
    $payPeriodDisplay = $payPeriod->format('F, Y');
    } catch (\Exception $e) {
    $payPeriodDisplay = 'Invalid Date';
    }
    }
    @endphp

    <div class="payslip-container">
        <table class="main-table">
            <tr>
                <!-- Employee Copy -->
                <td>
                    <table class="header-table">
                        <tr>
                            <td style="width: 30%;">
                                <img src="{{ public_path('images/btl_logo.png') }}" alt="Logo" style="width:100px;">
                            </td>
                            <td style="text-align:right; vertical-align:middle;">
                                <div style="font-weight:bold; font-size:16px;">Bandhab Tex Limited</div>
                                <div style="font-size:14px; font-weight:bold;">Employee Copy</div>
                                <div style="font-size:12px;">Payslip for: {{ $payPeriodDisplay }}</div>
                            </td>
                        </tr>
                    </table>

                    <table class="details-table">
                        <tr>
                            <th>Name</th>
                            <td>{{ $data['employee_name'] ?? 'N/A' }}</td>
                        </tr>
                        <tr>
                            <th>Employee ID</th>
                            <td>{{ $data['employee_id'] ?? 'N/A' }}</td>
                        </tr>
                        <tr>
                            <th>Department</th>
                            <td>{{ $data['department'] ?? 'N/A' }}</td>
                        </tr>
                        <tr>
                            <th>Designation</th>
                            <td>{{ $data['designation'] ?? 'N/A' }}</td>
                        </tr>
                        {{-- future enhancement --}}
                        {{-- <tr>
                            <th>Payment Method</th>
                            <td>
                                @if(($data['payment_method'] ?? '') == 'bank')
                                Bank Transfer
                                @elseif(($data['payment_method'] ?? '') == 'cash')
                                Cash Payment
                                @else
                                {{ $data['payment_method'] ?? 'N/A' }}
                                @endif
                            </td>
                        </tr> --}}
                        <tr>
                            <th>Total Attendance</th>
                            <td> <b>{{ $data['total_attendance'] ?? 'N/A' }}</b> Days</td>
                        </tr>

                        <tr>
                            <th>Process Date</th>
                            <td>{{ $data['process_date'] ?? 'N/A' }}</td>
                        </tr>

                    </table>

                    <table class="details-table">
                        <tr class="summary-row">
                            <th>Earnings</th>
                            <th>Amount</th>
                        </tr>
                        <tr>
                            <td>Basic Salary</td>
                            <td>{{ number_format($data['basic_salary'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Allowances</td>
                            <td>{{ number_format($data['allowances'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Overtime</td>
                            <td>{{ number_format($data['overtime'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Side Bill</td>
                            <td>{{ number_format($data['side_bill'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Attendance Bonus</td>
                            <td>{{ number_format($data['attendance_bonus'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Night Shift Bonus</td>
                            <td>{{ number_format($data['nightshift_bonus'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Bonus</td>
                            <td>{{ number_format($data['bonus'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr class="summary-row">
                            <td>Gross Salary</td>
                            <td>{{ number_format($data['gross_salary'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                    </table>

                    <table class="details-table">
                        <tr class="summary-row">
                            <th>Deductions</th>
                            <th>Amount</th>
                        </tr>
                        <tr>
                            <td>Tax</td>
                            <td>{{ number_format($data['tax'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr>
                            <td>Absence Deduction</td>
                            <td>{{ number_format($data['other_deductions'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr class="summary-row">
                            <td>Total Deductions</td>
                            <td>{{ number_format($data['total_deductions'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                        <tr class="summary-row">
                            <th>Net Salary</th>
                            <td>{{ number_format($data['net_salary'] ?? 0, 2) }} {{ $data['currency'] ?? 'BDT' }}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>

</body>
</html>
