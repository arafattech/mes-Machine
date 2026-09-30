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
        Schema::table('clients', function (Blueprint $table) {
            $table->string('first_contact_person_name')->nullable()->after('name');
            $table->string('first_contact_person_phone')->nullable()->after('first_contact_person_name');
            $table->string('second_contact_person_name')->nullable()->after('first_contact_person_phone');
            $table->string('second_contact_person_phone')->nullable()->after('second_contact_person_name');
            $table->string('email')->nullable()->after('second_contact_person_phone');
            $table->Text('address')->nullable()->after('email');
            $table->string('note')->nullable()->after('address');
            $table->string('tin')->nullable()->after('note');
            $table->string('bin')->nullable()->after('tin');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('first_contact_person_name');
            $table->dropColumn('first_contact_person_phone');
            $table->dropColumn('second_contact_person_name');
            $table->dropColumn('second_contact_person_phone');
            $table->dropColumn('email');
            $table->dropColumn('address');
            $table->dropColumn('note');
            $table->dropColumn('tin');
            $table->dropColumn('bin');
        });
    }
};
