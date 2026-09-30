<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Product;
use App\Models\Store\PurchaseRequisitionItem;
use App\Models\Store\ItemReturn;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Lines — one row per SR item being returned, capped at that item's received_quantity.
        Schema::create('item_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(ItemReturn::class, 'item_return_id')
                ->constrained('item_returns')
                ->cascadeOnDelete();
            $table->foreignIdFor(PurchaseRequisitionItem::class, 'purchase_requisition_item_id')
                ->constrained('purchase_requisition_items')
                ->cascadeOnDelete();
            $table->foreignIdFor(Product::class, 'product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('received_quantity')->default(0);
            $table->integer('return_quantity');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('item_return_items');
    }
};
