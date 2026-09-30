<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Store\MaterialReceiptItem;
use App\Models\Product;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('idle_inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique(); // Optional custom ID

            // 🔹 Relations
            $table->foreignIdFor(MaterialReceiptItem::class, 'material_receipt_item_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Product::class, 'product_id')->constrained()->cascadeOnDelete();

            // 🔹 Fields
            $table->integer('quantity');
            $table->string('condition')->nullable(); 
            $table->text('remarks')->nullable();    
            $table->date('created_date')->nullable();
            $table->date('expiry_date')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('idle_inventory_items');
    }
};
