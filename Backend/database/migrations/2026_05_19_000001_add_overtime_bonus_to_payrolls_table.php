<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'overtime_bonus')) {
                $table->decimal('overtime_bonus', 10, 2)->default(0)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('payrolls', 'overtime_bonus')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->dropColumn('overtime_bonus');
            });
        }
    }
};
