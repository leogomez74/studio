<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskDocument extends Model
{
    protected $fillable = [
        'task_id',
        'uploaded_by',
        'name',
        'path',
        'url',
        'mime_type',
        'size',
        'notes',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
