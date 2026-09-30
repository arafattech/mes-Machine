<?php

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
        Schema::create('product_hasvariants', function (Blueprint $table) {
            $table->id();
            $table->foreignId(column: 'product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreignId(column: 'variant_id')->references('id')->on('variants')->onDelete('cascade')->nullable();
            $table->string('variant_name', 255)->nullable();
            $table->string('variant_value', 255)->nullable();
            $table->string('variant_price_in_bdt')->nullable();
            $table->string('variant_price_in_usd')->nullable();
            $table->string('variant_unit_price')->nullable();
            $table->string('variant_currency')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_hasvariants');
    }
};
