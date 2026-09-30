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
        Schema::create('notices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('employee_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('custom_id')->unique();
            $table->string('title', 255)->nullable();
            $table->string('department', 255)->nullable();
            $table->longText('content')->nullable();
            $table->date('published_at')->nullable();

            $table->foreign('employee_id')->references('id')->on('notices')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notices');
    }
};
