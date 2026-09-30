<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Machine status stops being a hardcoded 5-value vocabulary duplicated across
     * DB enums and ~10 frontend/node-server files — `machine_states` becomes the
     * single source of truth for name, color, icon, and the two flags the runtime
     * pipeline needs: which state counts as "productive" time for OEE Availability,
     * and which wins when multiple configured channels read HIGH simultaneously.
     */
    public function up(): void
    {
        Schema::table('machine_states', function (Blueprint $table) {
            $table->string('color')->nullable()->after('name');
            $table->string('icon')->nullable()->after('color');
            $table->boolean('counts_as_productive')->default(false)->after('icon');
            $table->integer('priority')->default(0)->after('counts_as_productive');
        });
    }

    public function down(): void
    {
        Schema::table('machine_states', function (Blueprint $table) {
            $table->dropColumn(['color', 'icon', 'counts_as_productive', 'priority']);
        });
    }
};
