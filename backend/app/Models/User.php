<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Models\Rewards\RewardUser;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'status',
        'monto_max_aprobacion',
        'is_default_lead_assignee',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Gamification Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * Get user's reward profile
     */
    public function rewardUser(): HasOne
    {
        return $this->hasOne(RewardUser::class);
    }

    /**
     * Get or create user's reward profile
     */
    public function getOrCreateRewardUser(): RewardUser
    {
        return RewardUser::findOrCreateForUser($this);
    }

    /*
    |--------------------------------------------------------------------------
    | Role Relationship
    |--------------------------------------------------------------------------
    */

    /**
     * Get the role assigned to the user
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}
