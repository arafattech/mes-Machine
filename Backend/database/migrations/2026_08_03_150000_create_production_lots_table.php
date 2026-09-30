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
        // 🔹 Batch header — one doffing session, may span multiple yarn counts under one physical lot_no.
        Schema::create('production_lots', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();
            $table->string('lot_no')->nullable()->index();

            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->foreignId('machine_id')->nullable()->constrained('machines')->nullOnDelete();
            $table->foreignId('hall_id')->nullable()->constrained('halls')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('employee_shifts')->nullOnDelete();
            $table->foreignId('operator_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->date('lot_date');
            $table->dateTime('doffed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['machine_id', 'lot_date']);
            $table->index('work_order_id');
        });

        // 🔹 One row per yarn count within a batch — carries the QC/pack/reconcile lifecycle.
        Schema::create('production_lot_counts', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();

            $table->foreignId('production_lot_id')->constrained('production_lots')->cascadeOnDelete();
            $table->foreignId('count_type_id')->nullable()->constrained('count_types')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();

            $table->unsignedInteger('total_cones')->default(0);
            $table->unsignedInteger('total_bags')->default(0);
            $table->decimal('gross_weight_kg', 10, 2)->nullable();
            $table->decimal('net_weight_kg', 10, 2)->nullable();

            $table->string('qc_status')->nullable();
            $table->foreignId('qc_checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('qc_checked_at')->nullable();
            $table->text('qc_remark')->nullable();

            $table->foreignId('packed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('packed_at')->nullable();

            $table->integer('variance_cones')->nullable();
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reconciled_at')->nullable();
            $table->text('reconcile_remark')->nullable();

            $table->string('status')->default('DOFFED');
            $table->text('rejected_reason')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('production_lot_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_lot_counts');
        Schema::dropIfExists('production_lots');
    }
};
