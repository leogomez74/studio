<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TareaRutaEvidencia extends Model
{
    protected $table = 'tarea_ruta_evidencias';

    protected $fillable = [
        'tarea_ruta_id',
        'uploaded_by',
        'name',
        'path',
        'mime_type',
        'size',
        'notes',
    ];

    public function tareaRuta(): BelongsTo
    {
        return $this->belongsTo(TareaRuta::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
