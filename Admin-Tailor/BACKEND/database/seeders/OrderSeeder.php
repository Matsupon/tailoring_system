<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Order;
use App\Models\Appointment;
use Faker\Factory as Faker;

class OrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();
        
        // Get all appointments
        $appointments = Appointment::all();
        
        if ($appointments->isEmpty()) {
            $this->command->warn('No appointments found. Please run AppointmentSeeder first.');
            return;
        }

        // Statuses including Completed and Finished for Orders History
        $statuses = ['Pending', 'Ready to Check', 'Completed', 'Finished', 'Cancelled'];
        
        // Create orders for appointments that don't have orders yet
        $appointmentsWithoutOrders = $appointments->filter(function ($appointment) {
            return !$appointment->order;
        });

        $ordersToCreate = min(50, $appointmentsWithoutOrders->count());
        
        foreach ($appointmentsWithoutOrders->take($ordersToCreate) as $appointment) {
            $this->createOrder($appointment, $faker, $statuses);
        }

        // If we need more orders, create orders for appointments that already have orders
        $remaining = 50 - Order::count();
        if ($remaining > 0 && $appointments->count() > 0) {
            // Create additional orders for random appointments
            $randomAppointments = $appointments->random(min($remaining, $appointments->count()));
            
            foreach ($randomAppointments as $appointment) {
                if (Order::count() >= 50) break;
                
                // Delete existing order if any, then create new one
                if ($appointment->order) {
                    $appointment->order->delete();
                }
                
                $this->createOrder($appointment, $faker, $statuses);
            }
        }
    }

    private function createOrder($appointment, $faker, $statuses)
    {
        // Weight the statuses so we have more Completed/Finished orders for Orders History
        // Create weighted array: Completed and Finished appear more times
        $weightedStatuses = [
            'Pending', 'Pending',
            'Ready to Check',
            'Completed', 'Completed', 'Completed',
            'Finished', 'Finished', 'Finished',
            'Cancelled',
        ];
        
        $status = $faker->randomElement($weightedStatuses);
        $handled = in_array($status, ['Completed', 'Finished']) ? true : ($faker->boolean(30));
        
        $scheduledAt = null;
        $completedAt = null;
        $checkAppointmentDate = null;
        $checkAppointmentTime = null;
        $pickupAppointmentDate = null;
        $pickupAppointmentTime = null;

        if (in_array($status, ['Completed', 'Finished']) || $handled) {
            $scheduledAt = $faker->dateTimeBetween($appointment->created_at, 'now');
            if (in_array($status, ['Completed', 'Finished'])) {
                $completedAt = $faker->dateTimeBetween($scheduledAt, 'now');
            }
            
            if (in_array($status, ['Ready to Check', 'Completed', 'Finished'])) {
                $checkAppointmentDate = $faker->dateTimeBetween('now', '+1 month')->format('Y-m-d');
                $checkAppointmentTime = $faker->time('H:i:s');
                
                if (in_array($status, ['Completed', 'Finished'])) {
                    $pickupAppointmentDate = $faker->dateTimeBetween($checkAppointmentDate, '+2 weeks')->format('Y-m-d');
                    $pickupAppointmentTime = $faker->time('H:i:s');
                }
            }
        }

        Order::create([
            'appointment_id' => $appointment->id,
            'queue_number' => $faker->numberBetween(1, 1000),
            'status' => $status,
            'handled' => $handled,
            'scheduled_at' => $scheduledAt,
            'completed_at' => $completedAt,
            'total_amount' => $faker->randomFloat(2, 500, 5000),
            'check_appointment_date' => $checkAppointmentDate,
            'check_appointment_time' => $checkAppointmentTime,
            'pickup_appointment_date' => $pickupAppointmentDate,
            'pickup_appointment_time' => $pickupAppointmentTime,
        ]);
    }
}

