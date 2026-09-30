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
        Schema::create('supplier_bank_infos', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('supplier_id');
        $table->string('bank_name')->nullable();
        $table->string('account_holder_name')->nullable();
        $table->string('account_number')->nullable();
        $table->string('account_type')->nullable();
        $table->string('branch_name')->nullable();
        $table->string('branch_address')->nullable();
        $table->string('routing_number')->nullable();
        $table->string('swift_code')->nullable();
        $table->string('currency')->default('BDT');
        $table->string('country')->default('Bangladesh');
        $table->text('additional_notes')->nullable();
        $table->boolean('is_active')->default(false);
        $table->integer('approved_by')->nullable();
        $table->dateTime('approved_at')->nullable();
        $table->timestamps();

        $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_bank_infos');
    }
};
