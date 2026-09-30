<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('material_receipt_logs')) {
            return;
        }

        Schema::create('material_receipt_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_receipt_id')->constrained('material_receipts')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->integer('required_quantity')->default(0);
            $table->integer('received_quantity')->default(0);
            $table->integer('receiving_quantity')->default(0);
            $table->text('remark')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_receipt_logs');
    }
};
