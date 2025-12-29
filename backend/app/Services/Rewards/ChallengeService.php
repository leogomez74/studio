<?php

declare(strict_types=1);

namespace App\Services\Rewards;

use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardChallengeParticipation;
use App\Models\Rewards\RewardTransaction;
use App\Events\Rewards\ChallengeCompleted;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ChallengeService
{
    protected RewardService $rewardService;

    public function __construct(RewardService $rewardService)
    {
        $this->rewardService = $rewardService;
    }

    /**
     * Obtiene los challenges según el estado.
     */
    public function getChallenges(RewardUser $user, string $status = 'active'): array
    {
        $query = RewardChallenge::query();

        switch ($status) {
            case 'active':
                $query->where('is_active', true)
                    ->where('starts_at', '<=', now())
                    ->where('ends_at', '>=', now());
                break;
            case 'upcoming':
                $query->where('is_active', true)
                    ->where('starts_at', '>', now());
                break;
            case 'completed':
                $challengeIds = RewardChallengeParticipation::where('reward_user_id', $user->id)
                    ->whereNotNull('completed_at')
                    ->pluck('challenge_id');
                $query->whereIn('id', $challengeIds);
                break;
            case 'joined':
                $challengeIds = RewardChallengeParticipation::where('reward_user_id', $user->id)
                    ->pluck('challenge_id');
                $query->whereIn('id', $challengeIds);
                break;
        }

        return $query->orderBy('ends_at')->get()->map(function ($challenge) use ($user) {
            $participation = $this->getParticipation($user, $challenge);

            return [
                'id' => $challenge->id,
                'slug' => $challenge->slug,
                'name' => $challenge->name,
                'description' => $challenge->description,
                'type' => $challenge->type,
                'difficulty' => $challenge->difficulty,
                'objectives' => $challenge->objectives,
                'rewards' => [
                    'points' => $challenge->points_reward,
                    'xp' => $challenge->xp_reward,
                ],
                'startDate' => $challenge->starts_at,
                'endDate' => $challenge->ends_at,
                'isActive' => $challenge->is_active,
                'isJoined' => $participation !== null,
                'isCompleted' => $participation?->completed_at !== null,
                'progress' => $participation ? [
                    'overallProgress' => $this->calculateOverallProgress($participation->progress ?? []),
                    'completedAt' => $participation->completed_at,
                    'joinedAt' => $participation->joined_at,
                ] : null,
                'participantsCount' => $challenge->participations()->count(),
                'maxParticipants' => $challenge->max_participants,
            ];
        })->toArray();
    }

    /**
     * Calcula el progreso general de un challenge.
     */
    protected function calculateOverallProgress(array $progress): float
    {
        if (empty($progress)) {
            return 0.0;
        }

        $total = 0;
        $count = 0;

        foreach ($progress as $obj) {
            if (isset($obj['current']) && isset($obj['target']) && $obj['target'] > 0) {
                $total += min(1, $obj['current'] / $obj['target']);
                $count++;
            }
        }

        return $count > 0 ? $total / $count : 0.0;
    }

    /**
     * Obtiene la participación del usuario en un challenge.
     */
    public function getParticipation(RewardUser $user, RewardChallenge $challenge): ?RewardChallengeParticipation
    {
        return RewardChallengeParticipation::where('reward_user_id', $user->id)
            ->where('challenge_id', $challenge->id)
            ->first();
    }

    /**
     * Une al usuario a un challenge.
     */
    public function joinChallenge(RewardUser $user, RewardChallenge $challenge): RewardChallengeParticipation
    {
        // Verificar si ya está participando
        if ($this->getParticipation($user, $challenge)) {
            throw new \Exception('Ya estás participando en este desafío.');
        }

        // Verificar si el challenge está activo
        if (!$challenge->is_active) {
            throw new \Exception('Este desafío no está activo.');
        }

        // Verificar fechas
        $now = now();
        if ($challenge->starts_at && $now < $challenge->starts_at) {
            throw new \Exception('Este desafío aún no ha comenzado.');
        }
        if ($challenge->ends_at && $now > $challenge->ends_at) {
            throw new \Exception('Este desafío ya ha terminado.');
        }

        // Verificar máximo de participantes
        if ($challenge->max_participants) {
            $currentParticipants = $challenge->participations()->count();
            if ($currentParticipants >= $challenge->max_participants) {
                throw new \Exception('Este desafío ha alcanzado el máximo de participantes.');
            }
        }

        // Verificar requisitos
        if ($challenge->requirements) {
            $this->validateRequirements($user, $challenge->requirements);
        }

        return RewardChallengeParticipation::create([
            'challenge_id' => $challenge->id,
            'reward_user_id' => $user->id,
            'progress' => $this->initializeProgress($challenge->objectives),
            'joined_at' => now(),
        ]);
    }

    /**
     * Valida los requisitos para unirse a un challenge.
     */
    protected function validateRequirements(RewardUser $user, array $requirements): void
    {
        if (isset($requirements['min_level']) && $user->level < $requirements['min_level']) {
            throw new \Exception("Necesitas nivel {$requirements['min_level']} para unirte a este desafío.");
        }

        if (isset($requirements['min_points']) && $user->total_points < $requirements['min_points']) {
            throw new \Exception("Necesitas {$requirements['min_points']} puntos para unirte a este desafío.");
        }
    }

    /**
     * Inicializa el progreso de un challenge.
     */
    protected function initializeProgress(array $objectives): array
    {
        $progress = [];

        foreach ($objectives as $key => $objective) {
            $progress[$key] = [
                'target' => $objective['target'] ?? 1,
                'current' => 0,
                'completed' => false,
            ];
        }

        return $progress;
    }

    /**
     * Obtiene el progreso del usuario en un challenge.
     */
    public function getProgress(RewardUser $user, RewardChallenge $challenge): ?array
    {
        $participation = $this->getParticipation($user, $challenge);

        if (!$participation) {
            return null;
        }

        $objectives = $challenge->objectives;
        $progress = $participation->progress ?? [];

        $totalObjectives = count($objectives);
        $completedObjectives = 0;
        $overallProgress = 0;

        $objectiveDetails = [];
        foreach ($objectives as $key => $objective) {
            $current = $progress[$key]['current'] ?? 0;
            $target = $objective['target'] ?? 1;
            $completed = $current >= $target;

            if ($completed) {
                $completedObjectives++;
            }

            $objectiveProgress = $target > 0 ? min(1, $current / $target) : 1;
            $overallProgress += $objectiveProgress;

            $objectiveDetails[$key] = [
                'name' => $objective['name'] ?? $key,
                'description' => $objective['description'] ?? null,
                'current' => $current,
                'target' => $target,
                'progress' => $objectiveProgress,
                'completed' => $completed,
            ];
        }

        return [
            'is_completed' => $participation->completed_at !== null,
            'completed_at' => $participation->completed_at,
            'joined_at' => $participation->joined_at,
            'overall_progress' => $totalObjectives > 0 ? $overallProgress / $totalObjectives : 0,
            'completed_objectives' => $completedObjectives,
            'total_objectives' => $totalObjectives,
            'objectives' => $objectiveDetails,
            'rewards_claimed' => $participation->rewards_claimed,
        ];
    }

    /**
     * Actualiza el progreso de un objetivo.
     */
    public function updateProgress(
        RewardUser $user,
        string $objectiveType,
        int $increment = 1,
        array $context = []
    ): void {
        // Obtener challenges activos donde el usuario participa
        $participations = RewardChallengeParticipation::where('reward_user_id', $user->id)
            ->whereNull('completed_at')
            ->whereHas('challenge', function ($q) {
                $q->where('is_active', true)
                    ->where('ends_at', '>=', now());
            })
            ->with('challenge')
            ->get();

        foreach ($participations as $participation) {
            $challenge = $participation->challenge;
            $objectives = $challenge->objectives;
            $progress = $participation->progress ?? [];

            $updated = false;

            foreach ($objectives as $key => $objective) {
                if (($objective['type'] ?? $key) === $objectiveType) {
                    if (!isset($progress[$key])) {
                        $progress[$key] = [
                            'target' => $objective['target'] ?? 1,
                            'current' => 0,
                            'completed' => false,
                        ];
                    }

                    if (!$progress[$key]['completed']) {
                        $progress[$key]['current'] += $increment;

                        if ($progress[$key]['current'] >= $progress[$key]['target']) {
                            $progress[$key]['completed'] = true;
                        }

                        $updated = true;
                    }
                }
            }

            if ($updated) {
                $participation->update(['progress' => $progress]);

                // Verificar si el challenge está completo
                $allCompleted = true;
                foreach ($progress as $obj) {
                    if (!($obj['completed'] ?? false)) {
                        $allCompleted = false;
                        break;
                    }
                }

                if ($allCompleted) {
                    $this->completeChallenge($participation);
                }
            }
        }
    }

    /**
     * Completa un challenge y otorga recompensas.
     */
    protected function completeChallenge(RewardChallengeParticipation $participation): void
    {
        DB::transaction(function () use ($participation) {
            $participation->update([
                'completed_at' => now(),
            ]);

            $challenge = $participation->challenge;
            $user = $participation->rewardUser;

            $claimedRewards = [];

            // Otorgar puntos
            if ($challenge->points_reward > 0) {
                RewardTransaction::create([
                    'reward_user_id' => $user->id,
                    'type' => 'challenge_reward',
                    'amount' => $challenge->points_reward,
                    'currency' => 'points',
                    'description' => "Desafío completado: {$challenge->name}",
                    'reference_type' => 'challenge',
                    'reference_id' => $challenge->id,
                    'balance_after' => $user->total_points + $challenge->points_reward,
                ]);
                $user->increment('total_points', $challenge->points_reward);
                $user->increment('lifetime_points', $challenge->points_reward);
                $claimedRewards['points'] = $challenge->points_reward;
            }

            // Otorgar XP
            if ($challenge->xp_reward > 0) {
                $user->increment('experience_points', $challenge->xp_reward);
                $claimedRewards['xp'] = $challenge->xp_reward;
            }

            $participation->update([
                'rewards_claimed' => $claimedRewards,
            ]);

            event(new ChallengeCompleted($user, $challenge, $participation));
        });
    }
}
