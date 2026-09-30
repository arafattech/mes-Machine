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
        Schema::create('id_generator_settings', function (Blueprint $table) {
            $table->id();  
            $table->string('entity', 255);  
            $table->string('table', 255);  
            $table->string('prefix', 255)->nullable();  
            $table->string('field', 255);  
            $table->integer('length'); 
            $table->boolean('reset_on_prefix_change')->default(false);  
            $table->boolean('is_date_prefix')->default(false);  
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('id_generator_settings');
    }
};
