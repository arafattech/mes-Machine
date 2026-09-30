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
     
        Schema::create("machine_has_groups", function (Blueprint $table) {
            $table->foreignId('machine_id')->references('id')->on('machines')->onDelete('cascade');
            $table->foreignId('machine_group_id')->references('id')->on('machine_groups')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_has_groups');
    }
};
