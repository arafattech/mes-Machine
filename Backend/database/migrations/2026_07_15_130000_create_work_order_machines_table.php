<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A work order can run across multiple machines (and shifts).
     */
    public function up(): void
    {
        Schema::create('work_order_machines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['work_order_id', 'machine_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_machines');
    }
};
