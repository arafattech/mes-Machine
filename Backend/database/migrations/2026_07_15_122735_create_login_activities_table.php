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
        Schema::create('login_activities', function (Blueprint $table) {
            $table->id();
            $table->string('table_name')->default('User');
            $table->unsignedBigInteger('table_id');
            $table->string('user_name');
            $table->string('ip_address')->nullable();
            $table->dateTime('login_time');
            $table->dateTime('logout_time')->nullable();
            $table->date('login_date');
            $table->string('token')->nullable()->index();
            $table->text('login_response')->nullable();
            $table->text('logout_response')->nullable();
            $table->timestamps();

            $table->foreign('table_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('login_activities');
    }
};
