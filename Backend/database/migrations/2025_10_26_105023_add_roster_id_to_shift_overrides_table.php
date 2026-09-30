<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('shift_overrides', function (Blueprint $table) {
            $table->foreignId('roster_id')->nullable()->constrained('rosters')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('shift_overrides', function (Blueprint $table) {
            $table->dropConstrainedForeignId('roster_id');
        });
    }
};
