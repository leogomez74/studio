<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CreditDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'credit_id',
        'name',
        'notes',
        'path',
        'url',
        'mime_type',
        'size',
    ];

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }
}
