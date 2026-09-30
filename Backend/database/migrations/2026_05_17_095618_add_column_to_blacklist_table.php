<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('employee_blacklists', function (Blueprint $table) {
            $table->boolean('status')->default(false)->after('updated_at');
            $table->LongText('revoke_reason')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employee_blacklists', function (Blueprint $table) {
            $table->dropColumn('status');
            $table->dropColumn('revoke_reason');
        });
    }
};
