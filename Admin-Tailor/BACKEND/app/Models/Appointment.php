<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $fillable = [
        'user_id',
        'service_type',
        'sizes',
        'total_quantity',
        'notes',
        'design_image',
        'gcash_proof',
        'refund_image',
        'preferred_due_date',
        'appointment_date',
        'appointment_time',
        'status',
        'state',
    ];

    protected $casts = [
        'preferred_due_date' => 'date',
        'appointment_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function order()
{
    return $this->hasOne(Order::class);
}
}
