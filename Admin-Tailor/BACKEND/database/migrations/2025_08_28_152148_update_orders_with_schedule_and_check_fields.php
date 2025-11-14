<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Schedule fields
            if (!Schema::hasColumn('orders', 'scheduled_at')) {
                $table->dateTime('scheduled_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('orders', 'completed_at')) {
                $table->dateTime('completed_at')->nullable()->after('scheduled_at');
            }
            if (!Schema::hasColumn('orders', 'total_amount')) {
                $table->decimal('total_amount', 10, 2)->nullable()->after('completed_at');
            }

            // Check appointment fields
            if (!Schema::hasColumn('orders', 'check_appointment_date')) {
                $table->date('check_appointment_date')->nullable()->after('total_amount');
            }
            if (!Schema::hasColumn('orders', 'check_appointment_time')) {
                $table->time('check_appointment_time')->nullable()->after('check_appointment_date');
            }

            // Pickup appointment fields
            if (!Schema::hasColumn('orders', 'pickup_appointment_date')) {
                $table->date('pickup_appointment_date')->nullable()->after('check_appointment_time');
            }
            if (!Schema::hasColumn('orders', 'pickup_appointment_time')) {
                $table->time('pickup_appointment_time')->nullable()->after('pickup_appointment_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = [
                'scheduled_at',
                'completed_at',
                'total_amount',
                'check_appointment_date',
                'check_appointment_time',
                'pickup_appointment_date',
                'pickup_appointment_time',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
