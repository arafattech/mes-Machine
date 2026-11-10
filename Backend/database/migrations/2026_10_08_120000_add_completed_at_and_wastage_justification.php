<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dateTime('completed_at')->nullable()->after('actual_start');
        });

        // Best available completion time for orders completed before this column existed.
        DB::table('work_orders')->where('status', 'completed')->update(['completed_at' => DB::raw('updated_at')]);

        Schema::table('machine_wastage_entries', function (Blueprint $table) {
            $table->text('justification')->nullable()->after('qty_kg');
        });
    }

    public function down(): void
    {
        Schema::table('machine_wastage_entries', function (Blueprint $table) {
            $table->dropColumn('justification');
        });

        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });
    }
};
