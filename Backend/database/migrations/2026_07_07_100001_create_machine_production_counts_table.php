<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only bucketed production history, written by node-server on shot
     * events. Replaces `machine_counters` (a single upsert-per-machine row with
     * no history) as the source for achieved/ok/waste reporting; `machine_counters`
     * keeps serving the live cumulative needle unchanged.
     */
    public function up(): void
    {
        Schema::create('machine_production_counts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('machine_id')
                ->constrained('machines')
                ->cascadeOnDelete();

            $table->foreignId('work_order_id')
                ->nullable()
                ->constrained('work_orders')
                ->nullOnDelete();

            $table->foreignId('shift_id')
                ->nullable()
                ->constrained('employee_shifts')
                ->nullOnDelete();

            $table->dateTime('bucket_started_at');
            $table->dateTime('bucket_ended_at');
            $table->unsignedInteger('good_count')->default(0);
            $table->unsignedInteger('scrap_count')->default(0);
            $table->unsignedInteger('total_count')->default(0);

            $table->timestamps();

            $table->index(['machine_id', 'bucket_started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_production_counts');
    }
};
