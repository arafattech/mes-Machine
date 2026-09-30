<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `taktzeit` (ideal cycle time) has only ever lived in node-server's local
     * `machines.json` override file — never in the shared DB, so Laravel/OData/
     * the frontend can't read it. This column becomes the real source of truth
     * for the Performance OEE metric; the JSON-override path is untouched here.
     */
    public function up(): void
    {
        Schema::table('machine_has_configs', function (Blueprint $table) {
            $table->unsignedInteger('ideal_cycle_seconds')->nullable()->after('min_temp');
        });
    }

    public function down(): void
    {
        Schema::table('machine_has_configs', function (Blueprint $table) {
            $table->dropColumn('ideal_cycle_seconds');
        });
    }
};
