{{-- <!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Barcode PDF</title>
    <style>
        body { text-align: center; font-family: Arial, sans-serif; }
        .barcode { margin-top: 50px; }
    </style>
</head>
<body>
    <h2>Product Barcode</h2>
    <div class="barcode">{!! $barcode !!}</div>
</body>
</html> --}}


{{-- <!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Product Barcode</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 50px;
        }
        .label-box {
            border: 1px solid #000;
            padding: 30px;
            width: 400px;
            margin: auto;
            text-align: center;
        }
        .product-id {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .barcode {
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="label-box">
        <div class="product-id">Product ID: {{ $custom_id }}</div>
        <div class="barcode">{!! $barcode !!}</div>
    </div>
</body>
</html> --}}


<!-- resources/views/barcode-pdf.blade.php -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Product Labels</title>
    <style>
        body {
            font-family: sans-serif;
            margin: 20px;
        }
        .label-grid {
            display: flex;
            flex-wrap: wrap;
        }
        .label {
            width: 45%;
            border: 1px dashed #999;
            padding: 15px;
            margin: 2.5%;
            text-align: center;
            page-break-inside: avoid;
        }
        .label .custom-id {
            font-size: 16px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h3 style="text-align: center;">Product Barcode Labels</h3>
    <div class="label-grid">
            <div class="label">
                {!! $barcode !!}
                <div class="custom-id">{{ $item_code }}</div>
            </div>
    </div>
</body>
</html>
