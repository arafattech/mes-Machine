<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `overview()` (node-server) filters both `bucket_started_at` and
     * `bucket_ended_at` on this table; only `[machine_id, bucket_started_at]`
     * existed, leaving the `bucket_ended_at` filter unindexed at scale.
     */
    public function up(): void
    {
        Schema::table('machine_production_counts', function (Blueprint $table) {
            $table->index(['machine_id', 'bucket_ended_at']);
        });
    }

    public function down(): void
    {
        Schema::table('machine_production_counts', function (Blueprint $table) {
            $table->dropIndex(['machine_id', 'bucket_ended_at']);
        });
    }
};
