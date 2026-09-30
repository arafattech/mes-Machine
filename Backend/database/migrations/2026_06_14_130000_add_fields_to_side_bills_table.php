<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('side_bills', function (Blueprint $table) {
            $table->unsignedBigInteger('machine_group_id')->nullable()->after('machine_id');
            $table->date('side_bill_date')->nullable()->after('status');
            $table->unsignedBigInteger('current_working_machine_id')->nullable()->after('side_bill_date');
            $table->unsignedBigInteger('side_working_machine_id')->nullable()->after('current_working_machine_id');
            $table->string('side')->nullable()->after('side_working_machine_id');
            $table->unsignedBigInteger('shift_id')->nullable()->after('side');

            $table->foreign('machine_group_id')
                ->references('id')->on('machine_groups')->nullOnDelete();
            $table->foreign('current_working_machine_id')
                ->references('id')->on('machines')->nullOnDelete();
            $table->foreign('side_working_machine_id')
                ->references('id')->on('machines')->nullOnDelete();
            $table->foreign('shift_id')
                ->references('id')->on('employee_shifts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('side_bills', function (Blueprint $table) {
            $table->dropForeign(['machine_group_id']);
            $table->dropForeign(['current_working_machine_id']);
            $table->dropForeign(['side_working_machine_id']);
            $table->dropForeign(['shift_id']);
            $table->dropColumn(['machine_group_id', 'side_bill_date', 'current_working_machine_id', 'side_working_machine_id', 'side', 'shift_id']);
        });
    }
};
