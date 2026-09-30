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
            $table->string('gender')->nullable()->after('last_name');
            $table->string('nid')->nullable()->after('gender');
            $table->string('religion')->nullable()->after('nid');
            $table->Text('present_address')->nullable()->after('religion');
            $table->Text('permanent_address')->nullable()->after('present_address');
            $table->string('emgerency_contact_person_name')->nullable()->after('permanent_address');
            $table->string('emgerency_contact_number')->nullable()->after('emgerency_contact_person_name');
            $table->string('emgerency_contact_relation')->nullable()->after('emgerency_contact_number');
            $table->string('supervisor_name')->nullable()->after('emgerency_contact_relation');
            $table->date('date_of_birth')->nullable()->after('supervisor_name');
            $table->string('blood_group')->nullable()->after('date_of_birth');
            $table->string('marital_status')->nullable()->after('blood_group');
            $table->date('joining_date')->nullable()->after('marital_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('gender');
            $table->dropColumn('nid');
            $table->dropColumn('religion');
            $table->dropColumn('present_address');
            $table->dropColumn('permanent_address');
            $table->dropColumn('emgerency_contact_person_name');
            $table->dropColumn('emgerency_contact_number');
            $table->dropColumn('emgerency_contact_relation');
            $table->dropColumn('supervisor_name');
            $table->dropColumn('date_of_birth');
            $table->dropColumn('blood_group');
            $table->dropColumn('marital_status');
            $table->dropColumn('joining_date');
        });
    }
};
