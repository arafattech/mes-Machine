<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Material Receipt {{ $receipt->custom_id }}</title>
    <style>
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 16px;
            line-height: 1.4;
        }
        table { width: 100%; border-collapse: collapse; }
        .border { border: 1px solid #000; }
        .border-top { border-top: 1px solid #000; }
        .border-right { border-right: 1px solid #000; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .fw-bold { font-weight: bold; }
        .p-5 { padding: 5px; }
        .p-8 { padding: 8px; }
        .mb-10 { margin-bottom: 10px; }
        .mt-10 { margin-top: 10px; }
        .title { font-size: 22px; font-weight: bold; }
        .section-title { font-size: 12px; font-weight: bold; margin-bottom: 6px; }
        .muted { color: #555; }
        .header-table {
            margin-bottom: 10px;
        }
        .header-table td {
            padding: 10px;
            vertical-align: middle;
        }
        .logo {
            width: 105px;
            height: auto;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .document-title {
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 0.4px;
            text-transform: uppercase;
        }
        .meta-line {
            margin-bottom: 3px;
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td width="25%">
                <img src="{{ public_path('images/btl_logo.png') }}" alt="BTL Logo" class="logo">
            </td>
            <td width="40%" class="text-center">
                <div class="company-name">Bandhab Tex Limited</div>
                <div class="document-title">Material Receipt</div>
            </td>
            <td width="35%" class="text-right">
                <div class="meta-line"><span class="fw-bold">Date:</span> {{ $receipt->receipt_date }}</div>
                <div class="meta-line"><span class="fw-bold">Status:</span> {{ $receipt->status }}</div>
                <div class="meta-line"><span class="fw-bold">Source:</span> {{ $receipt->source }}</div>
                <div class="meta-line"><span class="fw-bold">ID:</span> {{ $receipt->custom_id }}</div>
            </td>
        </tr>
    </table>

    <table class="border mb-10">
        <tr>
            <td width="50%" class="p-8 border-right">
                <div class="section-title">Receipt Info</div>
                <div><span class="fw-bold">PO No:</span> {{ $receipt->purchaseOrder?->custom_id ?? '-' }}</div>
                <div><span class="fw-bold">SPR No:</span> {{ $receipt->purchaseOrder?->requisition?->custom_id ?? $receipt->requisition?->custom_id ?? '-' }}</div>
                <div><span class="fw-bold">Supplier:</span> {{ $receipt->supplier?->name ?? '-' }}</div>
                <div><span class="fw-bold">Department:</span> {{ $receipt->department?->name ?? '-' }}</div>
            </td>
            <td width="50%" class="p-8">
                <div class="section-title">Reference</div>
                <div><span class="fw-bold">Invoice No:</span> {{ $receipt->invoice_no ?? '-' }}</div>
                <div><span class="fw-bold">LC No:</span> {{ $receipt->lc_no ?? '-' }}</div>
                <div><span class="fw-bold">Requested By:</span> {{ $receipt->requestBy?->name ?? '-' }}</div>
                <div><span class="fw-bold">Remarks:</span> {{ $receipt->remarks ?? '-' }}</div>
            </td>
        </tr>
    </table>

    <div class="section-title">Items</div>
    <table class="border">
        <thead>
            <tr>
                <th class="border-right p-5">#</th>
                <th class="border-right p-5">Item Code</th>
                <th class="border-right p-5">Item Name</th>
                <th class="border-right p-5">UOM</th>
                <th class="border-right p-5 text-right">Required Qty</th>
                <th class="border-right p-5 text-right">Received Qty</th>
                <th class="border-right p-5 text-right">Due Qty</th>
                <th class="p-5">Remark</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($items as $index => $item)
                <tr>
                    <td class="border-top border-right p-5 text-center">{{ $index + 1 }}</td>
                    <td class="border-top border-right p-5">{{ $item['item_code'] }}</td>
                    <td class="border-top border-right p-5">{{ $item['product_name'] }}</td>
                    <td class="border-top border-right p-5">{{ $item['uom'] }}</td>
                    <td class="border-top border-right p-5 text-right">{{ $item['required_quantity'] }}</td>
                    <td class="border-top border-right p-5 text-right">{{ $item['received_quantity'] }}</td>
                    <td class="border-top border-right p-5 text-right">{{ $item['due_quantity'] }}</td>
                    <td class="border-top p-5">{{ $item['remark'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" class="border-top p-8 text-center">No items found.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
