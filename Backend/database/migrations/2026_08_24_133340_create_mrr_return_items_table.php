<?php

use App\Models\Product;
use App\Models\Store\MrrReturn;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mrr_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(MrrReturn::class, 'mrr_return_id')
                ->constrained('mrr_returns')
                ->cascadeOnDelete();
            $table->foreignIdFor(Product::class, 'product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->integer('returned_quantity')->default(0);
            $table->integer('rejected_quantity')->nullable()->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mrr_return_items');
    }
};
