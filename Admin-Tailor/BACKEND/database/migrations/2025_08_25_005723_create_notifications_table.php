<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            // short machine-friendly identifier
            $table->string('type'); // e.g. appointment_booked, appointment_accepted, ready_to_check, order_completed
            // what the user sees in the list
            $table->string('title');
            // optional longer text (we’ll mostly build this on the client for the modal)
            $table->text('body')->nullable();
            // flexible payload (scheduled_at, total_amount, order_id, appointment_id, etc.)
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
