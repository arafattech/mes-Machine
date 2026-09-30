<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roster_has_groups', function (Blueprint $table) {
            $table->foreignId('roster_id')->references('id')->on('rosters')->onDelete('cascade');
            $table->foreignId('group_id')->references('id')->on('employee_groups')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roster_has_groups');
    }
};
