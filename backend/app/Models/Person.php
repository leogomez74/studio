<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Person extends Model
{
    use HasFactory;

    protected $table = 'persons';

    // Subclases (Lead, Client) definen su propio $fillable.
    // Aquí bloqueamos todo para evitar mass assignment accidental sobre la tabla base.
    protected $guarded = ['id'];

    public function documents()
    {
        return $this->hasMany(PersonDocument::class, 'person_id');
    }
}
