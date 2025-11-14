<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            ServiceTypeSeeder::class, // Keep only 3 service types
            UserSeeder::class,         // Customers
            AppointmentSeeder::class, // Appointments
            OrderSeeder::class,       // Orders (includes Orders History)
            FeedbackSeeder::class,    // Feedback
        ]);
    }
}
