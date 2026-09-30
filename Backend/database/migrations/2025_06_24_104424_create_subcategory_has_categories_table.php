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
        Schema::create('subcategory_has_categories', function (Blueprint $table) {
            $table->foreignId('category_id')->constrained('item_categories')->onDelete('cascade');
            $table->foreignId('subcategory_id')->constrained('item_subcategories')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subcategory_has_categories');
    }
};
