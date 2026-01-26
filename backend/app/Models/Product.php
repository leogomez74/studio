<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $table = 'products';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_default',
        'order_column',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'order_column' => 'integer',
    ];
}
