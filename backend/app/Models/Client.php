<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Client extends Model
{
    use HasFactory;

    protected $table = 'persons';

    protected $fillable = [
        'name',
        'cedula',
        'email',
        'phone',
        'direccion1', // Ojo: Usamos el nombre real de la BD
        'province',
        'canton',
        'user_id',
        'assigned_agent_id',
        'person_type_id'
    ];

    protected static function booted()
    {
        static::addGlobalScope('is_client', function (Builder $builder) {
            $builder->where('person_type_id', 2);
        });

        static::creating(function ($model) {
            $model->person_type_id = 2;
        });
    }

    public function assignedAgent()
    {
        return $this->belongsTo(User::class, 'assigned_agent_id');
    }

    // Relación con oportunidades (si aplica para clientes también)
    public function opportunities()
    {
        // Ajusta esto si tus clientes también se ligan por cédula
        return $this->hasMany(Opportunity::class, 'lead_cedula', 'cedula');
    }
}
