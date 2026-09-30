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
        Schema::create('yarn_transfer_advices', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();

            $table->foreignId('prepared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('hod_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('hod_approved_at')->nullable();
            $table->foreignId('store_received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('store_received_at')->nullable();
            $table->foreignId('gm_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('gm_approved_at')->nullable();

            $table->foreignId('from_hall_id')->nullable()->constrained('halls')->nullOnDelete();

            $table->date('transfer_date');
            $table->string('vehicle_no')->nullable();
            $table->text('remarks')->nullable();
            $table->string('status')->default('draft');
            $table->text('rejected_reason')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('yarn_transfer_advices');
    }
};
