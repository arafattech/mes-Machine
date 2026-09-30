<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mrr_returns', function (Blueprint $table) {
            $table->string('return_type')->nullable()->after('total_quantity');
            $table->string('reason')->nullable()->after('return_type');
        });
    }

    public function down(): void
    {
        Schema::table('mrr_returns', function (Blueprint $table) {
            $table->dropColumn(['return_type', 'reason']);
        });
    }
};
