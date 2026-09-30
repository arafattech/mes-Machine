<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->date('forecast_month');
            $table->decimal('predicted_qty', 15, 2);
            $table->decimal('predicted_change_percent', 8, 2);
            $table->enum('risk', ['high', 'medium', 'low']);
            $table->timestamp('run_at');
            $table->timestamps();

            $table->index(['product_id', 'forecast_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_forecasts');
    }
};
