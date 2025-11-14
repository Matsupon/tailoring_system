<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'user_id', 'type', 'title', 'body', 'data', 'read_at', 'is_viewed', 'viewed_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'is_viewed' => 'boolean',
        'viewed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
