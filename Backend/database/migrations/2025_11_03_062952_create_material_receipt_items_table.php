<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Store\MaterialReceipt;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Product;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('material_receipt_items', function (Blueprint $table) {
            $table->id();
            // 🔹 Relations
            $table->foreignIdFor(MaterialReceipt::class, 'material_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(PurchaseOrderItem::class, 'po_item_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Product::class, 'product_id')->constrained()->cascadeOnDelete();
            // 🔹 Fields
            $table->integer('received_quantity')->nullable()->default(0);
            $table->integer('previous_received_quantity')->nullable()->default(0);
            $table->text('remark')->nullable();

            $table->timestamps();
            $table->softDeletes(); 
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('material_receipt_items');
    }
};
