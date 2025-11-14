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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            // Link to appointment
            $table->foreignId('appointment_id')
                  ->constrained('appointments') // explicitly reference appointments table
                  ->onDelete('cascade');

            // Order-specific fields
            $table->unsignedInteger('queue_number')->nullable(); // allow null first
            $table->enum('status', ['Pending', 'Ongoing', 'Completed'])
                  ->default('Pending');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
