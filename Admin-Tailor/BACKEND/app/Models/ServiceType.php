<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceType extends Model
{
    protected $fillable = [
        'name',
        'downpayment_amount',
    ];

    protected $casts = [
        'downpayment_amount' => 'decimal:2',
    ];
}
