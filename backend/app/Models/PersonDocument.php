<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Person;

class PersonDocument extends Model
{
    protected $fillable = [
        'person_id',
        'name',
        'notes',
        'path',
        'url',
        'mime_type',
        'size',
    ];

    public function person()
    {
        return $this->belongsTo(Person::class);
    }

    public function getUrlAttribute($value)
    {
        if ($value && !str_starts_with($value, 'http')) {
            return asset($value);
        }
        return $value;
    }
}
