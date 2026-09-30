<?php

use App\Models\Product;
use App\Models\SalesOrder;
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
        Schema::create('sale_order_items', function (Blueprint $table) {
            $table->id();

            // 🔹 Relations
            
            $table->foreignIdFor(SalesOrder::class, 'sales_order_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Product::class, 'product_id')->constrained()->cascadeOnDelete();

            // 🔹 Fields
            $table->integer('quantity')->nullable(0);
            $table->decimal('unit_price', 15, 2)->nullable()->default(0);
            $table->decimal('minimum_unit_price', 15, 2)->nullable()->default(0);
            $table->decimal('total_price', 15, 2);
            $table->string('status')->default("PENDING"); 

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_order_items');
    }
};
