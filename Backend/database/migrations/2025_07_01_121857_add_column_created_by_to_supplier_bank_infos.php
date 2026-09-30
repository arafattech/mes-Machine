<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('supplier_bank_infos', function (Blueprint $table) {
            $table->integer('created_by')->after('approved_by')->nullable();
            
        });
    }


    public function down(): void
    {
        Schema::table('supplier_bank_infos', function (Blueprint $table) {
            $table->dropColumn('created_by');
        });
    }
};
