<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Faker\Factory as Faker;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();

        // Get actual profile images from storage
        $profileImages = collect(Storage::disk('public')->files('profile_images'))->filter(function($file) {
            return in_array(pathinfo($file, PATHINFO_EXTENSION), ['jpg', 'jpeg', 'png', 'gif']);
        })->values()->toArray();

        // Create 50+ users (customers)
        for ($i = 0; $i < 50; $i++) {
            // Use actual profile images from storage (30% chance of having a profile image)
            $profileImage = !empty($profileImages) && $faker->boolean(30) ? $faker->randomElement($profileImages) : null;

            User::create([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'phone' => $faker->phoneNumber(),
                'address' => $faker->address(),
                'password' => Hash::make('password123'),
                'profile_image' => $profileImage,
            ]);
        }
    }
}

