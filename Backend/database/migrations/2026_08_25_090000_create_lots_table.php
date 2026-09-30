<?php

use App\Models\Product;
use App\Models\Store\MaterialReceiptItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lots', function (Blueprint $table) {
            $table->id();

            $table->string('lot_number');
            // Nullable — a lot can exist without (yet) being tied to a specific
            // product or receiving line, and must never block on either.
            $table->foreignIdFor(Product::class, 'product_id')
                ->nullable()->constrained('products')->nullOnDelete();
            $table->foreignIdFor(MaterialReceiptItem::class, 'mrr_item_id')
                ->nullable()->constrained('material_receipt_items')->nullOnDelete();

            // ── Bale weight breakdown ────────────────────────────────────────────
            $table->unsignedInteger('bale_quantity')->default(0);
            $table->decimal('gross_weight_kg', 10, 2)->nullable();
            $table->decimal('tare_weight_kg', 10, 2)->nullable();
            // Measured directly off the scale sheet, not derived — gross minus tare
            // rounding rarely matches the actual net figure the mill records.
            $table->decimal('net_weight_kg', 10, 2)->nullable();

            // ── Enhancements ─────────────────────────────────────────────────────
            $table->decimal('moisture_pct', 5, 2)->nullable();
            $table->date('received_date')->nullable();
            $table->string('status')->default('IN_STOCK');
            $table->text('remarks')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique('lot_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lots');
    }
};
