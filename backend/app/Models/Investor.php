<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Investor extends Model
{
    use HasFactory;

    protected $table = 'investors';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'cedula',
        'email',
        'phone',
        'status',
        'investment_balance',
        'joined_at',
    ];

    protected $casts = [
        'investment_balance' => 'decimal:2',
        'joined_at' => 'date',
    ];

    protected static function booted()
    {
        static::creating(function ($investor) {
            if (empty($investor->id)) {
                $investor->id = (string) Str::random(20);
            }
        });
    }
}
