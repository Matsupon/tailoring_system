<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Feedback extends Model
{
    use HasFactory;

    protected $table = 'feedback';

    protected $fillable = [
        'order_id',
        'user_id',
        'rating',
        'comment',
        'admin_response',
        'admin_checked',
        'responded_at',
    ];

    protected $casts = [
        'admin_checked' => 'boolean',
        'responded_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
