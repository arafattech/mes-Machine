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
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_active')->default(true); 
            $table->boolean('is_read')->default(false); 
            $table->string('custom_id')->nullable(); 
            $table->integer('user_id'); 
            $table->string('user_name')->nullable(); 
            $table->string('user_email')->nullable(); 
            $table->string('model_type')->nullable(); 
            $table->integer('model_id')->nullable(); 
            $table->string('model_custom_id')->nullable(); 
            $table->string('action_type')->nullable(); 
            $table->text('old_value')->nullable(); 
            $table->text('new_value')->nullable(); 
            $table->string('ip_address')->nullable(); 
            $table->string('session_id')->nullable(); 
            $table->softDeletes(); 
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
