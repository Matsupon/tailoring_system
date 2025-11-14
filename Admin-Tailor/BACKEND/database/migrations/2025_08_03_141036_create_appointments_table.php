<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateAppointmentsTable extends Migration
{
    public function up()
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // Required field linking to users table
            $table->string('service_type');
            $table->json('sizes'); // { "Extra Small": 1, "Small": 2, ... }
            $table->integer('total_quantity');
            $table->text('notes')->nullable();
            $table->string('design_image')->nullable();
            $table->string('gcash_proof');
            $table->date('preferred_due_date');
            $table->date('appointment_date');
            $table->time('appointment_time');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('appointments');
    }
}