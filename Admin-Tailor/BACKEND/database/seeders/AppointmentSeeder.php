<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Appointment;
use App\Models\User;
use App\Models\ServiceType;
use Faker\Factory as Faker;
use Illuminate\Support\Facades\Storage;

class AppointmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();
        
        // Get all users
        $users = User::all();
        
        if ($users->isEmpty()) {
            $this->command->warn('No users found. Please run UserSeeder first.');
            return;
        }

        // Get the 3 service types
        $serviceTypes = ServiceType::pluck('name')->toArray();
        
        if (empty($serviceTypes)) {
            $this->command->warn('No service types found. Please run ServiceTypeSeeder first.');
            return;
        }

        // Get actual files from storage
        $designImages = collect(Storage::disk('public')->files('designs'))->filter(function($file) {
            return in_array(pathinfo($file, PATHINFO_EXTENSION), ['jpg', 'jpeg', 'png', 'gif']);
        })->values()->toArray();
        
        $gcashProofs = collect(Storage::disk('public')->files('gcash_proofs'))->filter(function($file) {
            return in_array(pathinfo($file, PATHINFO_EXTENSION), ['jpg', 'jpeg', 'png', 'gif']);
        })->values()->toArray();
        
        $refundImages = collect(Storage::disk('public')->files('refunds'))->filter(function($file) {
            return in_array(pathinfo($file, PATHINFO_EXTENSION), ['jpg', 'jpeg', 'png', 'gif']);
        })->values()->toArray();

        $statuses = ['pending', 'accepted', 'rejected'];
        $states = ['active', 'cancelled'];
        $sizes = ['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large', 'XXL'];

        // Create 50+ appointments
        for ($i = 0; $i < 50; $i++) {
            $user = $users->random();
            
            // Generate random sizes JSON
            $sizeData = [];
            $totalQuantity = 0;
            $selectedSizes = $faker->randomElements($sizes, $faker->numberBetween(1, 4));
            
            foreach ($selectedSizes as $size) {
                $quantity = $faker->numberBetween(1, 10);
                $sizeData[$size] = $quantity;
                $totalQuantity += $quantity;
            }

            $appointmentDate = $faker->dateTimeBetween('now', '+3 months');
            $preferredDueDate = $faker->dateTimeBetween($appointmentDate, '+6 months');

            // Use actual files from storage
            $designImage = !empty($designImages) && $faker->boolean(70) ? $faker->randomElement($designImages) : null;
            $gcashProof = !empty($gcashProofs) ? $faker->randomElement($gcashProofs) : null;
            $refundImage = !empty($refundImages) && $faker->boolean(20) ? $faker->randomElement($refundImages) : null;

            Appointment::create([
                'user_id' => $user->id,
                'service_type' => $faker->randomElement($serviceTypes),
                'sizes' => json_encode($sizeData),
                'total_quantity' => $totalQuantity,
                'notes' => $faker->optional()->sentence(),
                'design_image' => $designImage,
                'gcash_proof' => $gcashProof,
                'refund_image' => $refundImage,
                'preferred_due_date' => $preferredDueDate->format('Y-m-d'),
                'appointment_date' => $appointmentDate->format('Y-m-d'),
                'appointment_time' => $faker->time('H:i:s'),
                'status' => $faker->randomElement($statuses),
                'state' => $faker->randomElement($states),
            ]);
        }
    }
}

