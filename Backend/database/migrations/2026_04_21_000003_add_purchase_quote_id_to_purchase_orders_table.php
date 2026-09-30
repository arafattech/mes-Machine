<?php

use App\Models\Purchase\PurchaseQuote;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('purchase_orders', 'purchase_quote_id')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->foreignIdFor(PurchaseQuote::class, 'purchase_quote_id')
                    ->nullable()
                    ->after('supplier_id')
                    ->constrained('purchase_quotes')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_orders', 'purchase_quote_id')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropConstrainedForeignId('purchase_quote_id');
            });
        }
    }
};

