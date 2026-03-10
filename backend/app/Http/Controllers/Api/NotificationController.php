<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Credit;
use App\Models\Analisis;
use App\Models\Lead;
use App\Models\Client;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private const TYPE_MAP = [
        'credit'      => Credit::class,
        'opportunity' => \App\Models\Opportunity::class,
        'lead'        => Lead::class,
        'client'      => Client::class,
        'analisis'    => Analisis::class,
    ];

    public function index(Request $request)
    {
        $query = Notification::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc');

        if ($request->has('unread')) {
            $query->whereNull('read_at');
        }

        $paginated = $query->paginate(20);

        $paginated->getCollection()->transform(function ($notif) {
            $data = $notif->data;
            if (is_array($data) && !empty($data['commentable_type']) && !empty($data['commentable_id']) && empty($data['entity_reference'])) {
                $modelClass = self::TYPE_MAP[$data['commentable_type']] ?? null;
                if ($modelClass) {
                    $entity = $modelClass::find($data['commentable_id']);
                    if ($entity) {
                        $ref = match (true) {
                            $entity instanceof Credit   => $entity->reference ?? "#{$entity->id}",
                            $entity instanceof Analisis => $entity->reference ?? "#{$entity->id}",
                            $entity instanceof Lead, $entity instanceof Client => $entity->cedula ?? $entity->name ?? "#{$entity->id}",
                            default => (string) $data['commentable_id'],
                        };
                        $data['entity_reference'] = $ref;
                        $notif->data = $data;
                    }
                }
            }
            return $notif;
        });

        return response()->json($paginated);
    }

    public function count(Request $request)
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    public function markAsRead(Request $request, int $id)
    {
        $notification = Notification::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $notification->update(['read_at' => now()]);

        return response()->json($notification);
    }

    public function markAllAsRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'Todas las notificaciones marcadas como leídas']);
    }
}
