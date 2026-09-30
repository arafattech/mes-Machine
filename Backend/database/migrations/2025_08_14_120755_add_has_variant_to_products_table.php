<?php
 
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
 
return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('has_variant')->default(false)->after('is_variant'); 
            $table->foreignId('variant_id')->after('is_variant')->nullable(); 
            $table->string('variant_value', 255)->nullable();
        });
    }
 
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('has_variant');
            $table->dropColumn('variant_id');
            $table->dropColumn('variant_value');
        });
    }
};