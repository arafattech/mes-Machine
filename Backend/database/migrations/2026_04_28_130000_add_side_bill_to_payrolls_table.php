<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'side_bill')) {
                $table->decimal('side_bill', 10, 2)->default(0)->after('bonuses');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('payrolls', 'side_bill')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->dropColumn('side_bill');
            });
        }
    }
};
