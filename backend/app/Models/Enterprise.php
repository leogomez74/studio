<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Enterprise extends Model
{
    use HasFactory;

    protected $table = 'enterprises';

    protected $fillable = [
        'business_name',
    ];

    public function requirements()
    {
        return $this->hasMany(EnterpriseRequirement::class);
    }
}
