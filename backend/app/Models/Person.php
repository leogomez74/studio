<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Person extends Model
{
    use HasFactory;

    protected $table = 'persons';

    // Subclases (Lead, Client) definen su propio $fillable.
    // Bloqueamos escritura directa sobre el modelo base.
    protected $guarded = ['*'];

    public function documents()
    {
        return $this->hasMany(PersonDocument::class, 'person_id');
    }
}
