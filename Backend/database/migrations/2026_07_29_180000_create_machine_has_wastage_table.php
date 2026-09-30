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
        Schema::create('machine_has_wastage', function (Blueprint $table) {
            $table->foreignId('machine_id')->constrained('machines')->onDelete('cascade');
            $table->foreignId('wastage_id')->constrained('machine_wastage_types')->onDelete('cascade');
            $table->unique(['machine_id', 'wastage_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_has_wastage');
    }
};
