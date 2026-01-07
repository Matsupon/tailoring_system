<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\ServiceType;

class ServiceTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $serviceTypes = [
            [
                'name' => 'Jersey Production',
                'downpayment_amount' => 500.00,
            ],
            [
                'name' => 'Custom Tailoring (eg. Uniforms)',
                'downpayment_amount' => 500.00,
            ],
            [
                'name' => 'Repairs/Alterations (eg. incl. zippers, buttons, size alteration etc.)',
                'downpayment_amount' => 100.00,
            ],
        ];

        foreach ($serviceTypes as $serviceType) {
            ServiceType::updateOrCreate(
                ['name' => $serviceType['name']],
                ['downpayment_amount' => $serviceType['downpayment_amount']]
            );
        }
    }
}
