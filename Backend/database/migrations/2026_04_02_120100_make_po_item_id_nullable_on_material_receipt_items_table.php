<?php

use App\Models\Purchase\PurchaseOrderItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('material_receipt_items', function (Blueprint $table) {
            $table->foreignIdFor(PurchaseOrderItem::class, 'po_item_id')
                ->nullable()
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('material_receipt_items', function (Blueprint $table) {
            $table->foreignIdFor(PurchaseOrderItem::class, 'po_item_id')
                ->nullable(false)
                ->change();
        });
    }
};
