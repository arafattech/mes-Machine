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
        Schema::table('employees', function (Blueprint $table) {
            $table->text('address')->nullable()->after('role');
            $table->string('contact_number')->nullable()->after('address');
            $table->string('email')->unique()->nullable()->after('contact_number');
            $table->string('employee_no')->nullable()->after('email');
            $table->string('refered_by')->nullable()->after('employee_no');
            $table->string('department')->nullable()->after('refered_by');
            $table->string('designation')->nullable()->after('department');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('address');
            $table->dropColumn('contact_number');
            $table->dropColumn('email');
            $table->dropColumn('employee_no');
            $table->dropColumn('refered_by');
            $table->dropColumn('department');
            $table->string('designation');
        });
    }
};
