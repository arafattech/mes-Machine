<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {{ $data['order_no'] }}</title>

    <style>
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 15px;
            line-height: 1.4;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .fw-bold {
            font-weight: bold;
        }

        .border {
            border: 1px solid #000;
        }

        .border-top {
            border-top: 2px solid #000;
        }

        .border-bottom {
            border-bottom: 2px solid #000;
        }

        .border-left {
            border-left: 1px solid #000;
        }

        .border-right {
            border-right: 1px solid #000;
        }

        .mt-20 {
            margin-top: 20px;
        }

        .mb-10 {
            margin-bottom: 10px;
        }

        .p-10 {
            padding: 10px;
        }

        .p-5 {
            padding: 5px;
        }

        .logo {
            height: 60px;
        }

        h1,
        h2,
        h3 {
            margin: 0;
            padding: 0;
        }

        /* Watermark */
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: bold;
            z-index: -1;
            text-transform: uppercase;
            white-space: nowrap;
            color: #000;
            opacity: 0.08;
        }

        .wm-draft {
            color: #ACACAC;
            opacity: 0.10;
        }

        .wm-pending {
            color: #6282F5;
            opacity: 0.10;
        }

        .wm-approved {
            color: #28A745;
            opacity: 0.10;
        }

        .wm-rejected {
            color: #DC3545;
            opacity: 0.12;
        }

        .status-badge {
            padding:10px;
            font-weight: 700;
            font-size: 0.875rem;
            text-transform: uppercase;
            border-radius: 5px;
            display: inline-block;
        }

        .badge-draft {
            background-color: #ACACAC;
        }

        .badge-pending {
            background-color: #6282F5;
        }

        .badge-approved {
            background-color: #28A745;
        }

        .badge-rejected {
            background-color: #DC3545;
            color: #000;
        }

    </style>
</head>

<body>

    @php
    $status = strtoupper($data['status']);

    $watermarkClass = match ($status) {
    'DRAFT' => 'wm-draft',
    'PENDING' => 'wm-pending',
    'APPROVED' => 'wm-approved',
    'REJECTED' => 'wm-rejected',
    default => '',
    };
    @endphp

    <div class="watermark {{ $watermarkClass }}">
        {{ $status }}
    </div>



    <!-- Header -->
    <table>
        <tr>
            <td width="50%">
                <img src="{{ public_path('images/btl_logo.png') }}" class="logo">
                <br><br>
                <strong style="font-size:14px;">Bandhab Tex Limited</strong>
            </td>
            <td width="50%" class="text-right">
                <h1 style="font-size:28px;">INVOICE</h1>
                <strong>Invoice No:</strong> {{ $data['custom_id'] }}<br>
                <strong>Date:</strong> {{ $data['order_date'] }}<br>
                @php
                $status = strtoupper($data['status']);

                $watermarkClass = match ($status) {
                'DRAFT' => 'wm-draft',
                'PENDING' => 'wm-pending',
                'APPROVED' => 'wm-approved',
                'REJECTED' => 'wm-rejected',
                default => '',
                };

                $badgeClass = match ($status) {
                'DRAFT' => 'badge-draft',
                'PENDING' => 'badge-pending',
                'APPROVED' => 'badge-approved',
                'REJECTED' => 'badge-rejected',
                default => '',
                };
                @endphp
                <strong class="status-badge {{ $badgeClass }}">
                    {{ $status }}
                </strong>

            </td>
        </tr>
    </table>

    <br>

    <!-- Bill / Ship -->
    <table class="border mb-10">
        <tr>
            <td width="50%" class="p-5 border-right">
                <strong>Bill To:</strong><br>
                {{ $data['client_name'] }}<br>
                {!! nl2br(e($data['bill_to'])) !!}
            </td>
            <td width="50%" class="p-5">
                <strong>Ship To:</strong><br>
                {!! nl2br(e($data['ship_to'])) !!}<br><br>
                <strong>Email:</strong> {{ $data['client_email'] }}
            </td>
        </tr>
    </table>

    <!-- ================= ITEMS TABLE WITH FULL BORDERS ================= -->
    <table class="border">
        <thead>
            <tr>
                <th class="p-10 border border-right text-left">Description</th>
                <th class="p-10 border border-right text-center" width="12%">Qty</th>
                <th class="p-10 border border-right text-right" width="18%">Unit Price</th>
                 @if($data['discount_option'] == 'INDIVIDUAL')
                <th class="p-10 border border-right text-right" width="18%">Discount Amount</th>
                @endif
                <th class="p-10 border text-right" width="20%">Amount (BDT)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['items'] as $item)
            <tr>
                <td class="p-10 border border-right">
                    {{ $item->product->product_name ?? 'N/A' }}
                </td>
                <td class="p-10 border border-right text-center fw-bold">
                    {{ $item->quantity }}
                </td>
                <td class="p-10 border border-right text-right">
                    {{ number_format($item->unit_price) }}
                </td>
                @if($data['discount_option'] == 'INDIVIDUAL')

                <td class="p-10 border border-right text-right">
                    {{ number_format($item->discount_amount) }}
                </td>

                @endif

                <td class="p-10 border text-right fw-bold">
                    {{ number_format($item->total_price) }}
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
    <!-- ================================================================ -->

    <!-- Summary -->
    <table width="40%" style="float:right;margin-top:15px;" class="border">
        <tr>
            <td class="p-10 fw-bold">Subtotal</td>
            <td class="p-10 text-right fw-bold">{{ number_format($data['subtotal'], 2) }} BDT</td>
        </tr>
        <tr>
            <td class="p-10">VAT / Tax</td>
            <td class="p-10 text-right">{{ number_format($data['vat'], 2) }} BDT</td>
        </tr>
        <tr>
            <td class="p-10">Discount</td>
            <td class="p-10 text-right">{{ number_format($data['discount'], 2) }} BDT</td>
        </tr>
        <tr>
            <td class="p-10 fw-bold border-top">Grand Total</td>
            <td class="p-10 text-right fw-bold border-top" style="font-size:16px;">
                {{ number_format($data['grand_total'], 2) }} BDT
            </td>
        </tr>
    </table>

    <div style="clear:both;"></div>

    <!-- Note -->
    @if(!empty(trim($data['note'])))
    <div class="mt-20 p-10 border">
        <strong>Note:</strong><br>
        {!! nl2br(e($data['note'])) !!}
    </div>
    @endif

    <!-- Signatures -->
    <table width="100%" class="mt-20">
        <tr>
            <td width="50%" class="text-center">
                <br><br><br>
                <div style="border-top:2px solid #000;width:200px;margin:0 auto;"></div>
                <strong>Authorized Signature</strong><br>
                Bandhab Tex Limited
            </td>
            <td width="50%" class="text-center">
                <br><br><br>
                <div style="border-top:2px solid #000;width:200px;margin:0 auto;"></div>
                <strong>Received By</strong><br>
                Name & Signature
            </td>
        </tr>
    </table>

</body>
</html>
