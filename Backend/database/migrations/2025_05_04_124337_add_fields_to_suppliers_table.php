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
        Schema::table('suppliers', function (Blueprint $table) {
            $table->Text('address')->nullable()->after('name');
            $table->string('first_contact_person_name')->nullable()->after('address');
            $table->string('first_contact_person_phone')->nullable()->after('first_contact_person_name');
            $table->string('second_contact_person_name')->nullable()->after('first_contact_person_phone');
            $table->string('second_contact_person_phone')->nullable()->after('second_contact_person_name');
            $table->string('email')->nullable()->after('second_contact_person_phone');
            $table->Text('note')->nullable()->after('email');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('address');
            $table->dropColumn('first_contact_person_name');
            $table->dropColumn('first_contact_person_phone');
            $table->dropColumn('second_contact_person_name');
            $table->dropColumn('second_contact_person_phone');
            $table->dropColumn('email');
            $table->dropColumn('note');
        });
    }
};
