<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Store\PurchaseRequisition;
use App\Models\Product;
use App\Enums\Store\SprItemStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_requisition_items', function (Blueprint $table) {
            $table->id();
            // 🔹 Foreign keys
            $table->foreignIdFor(PurchaseRequisition::class, 'spr_id')
                ->constrained('purchase_requisitions')
                ->cascadeOnDelete();

            $table->foreignIdFor(Product::class, 'product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            // 🔹 Fields
            $table->integer('required_quantity')->nullable()->default(0);
            $table->string('status')->default(SprItemStatus::LOW->value);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_requisition_items');
    }
};
