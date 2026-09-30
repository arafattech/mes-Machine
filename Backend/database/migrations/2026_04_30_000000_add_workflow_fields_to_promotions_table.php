<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->string('status', 20)->default('pending')->index();
            $table->date('cycle_base_date')->nullable()->index();
            $table->date('eligibility_date')->nullable()->index();
            $table->date('expires_at')->nullable()->index();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->unique(['employee_id', 'cycle_base_date'], 'promotions_employee_cycle_unique');
        });

        DB::table('promotions')->update([
            'status' => 'approved',
            'approved_at' => DB::raw('updated_at'),
            'effective_date' => DB::raw('COALESCE(effective_date, promotion_date)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropUnique('promotions_employee_cycle_unique');
            $table->dropForeign(['approved_by']);
            $table->dropColumn([
                'status',
                'cycle_base_date',
                'eligibility_date',
                'expires_at',
                'approved_by',
                'approved_at',
            ]);
        });
    }
};
