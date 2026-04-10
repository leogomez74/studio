<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Notification;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CommentController extends Controller
{
    use LogsActivity;

    private array $typeMap = [
        'credit'      => 'App\\Models\\Credit',
        'opportunity' => 'App\\Models\\Opportunity',
        'lead'        => 'App\\Models\\Lead',
        'client'      => 'App\\Models\\Client',
        'analisis'    => 'App\\Models\\Analisis',
        'direct'      => 'App\\Models\\User',
        'user'        => 'App\\Models\\User',
    ];

    // GET /api/comments?commentable_type=credit&commentable_id=177
    public function index(Request $request)
    {
        $request->validate([
            'commentable_type' => 'required|string',
            'commentable_id'   => 'required',
        ]);

        $userId = $request->user()->id;
        $type = $this->typeMap[$request->commentable_type] ?? $request->commentable_type;
        $targetId = $request->commentable_id;

        $query = Comment::roots()->whereNull('archived_at');

        if ($type === User::class) {
            // Lógica para mensajes directos entre dos usuarios específicos
            $query->where(function ($q) use ($userId, $targetId) {
                // Mensajes de A para B
                $q->where(function ($sub) use ($userId, $targetId) {
                    $sub->where('user_id', $userId)
                        ->where('commentable_type', User::class)
                        ->where('commentable_id', $targetId);
                })
                // O mensajes de B para A
                ->orWhere(function ($sub) use ($userId, $targetId) {
                    $sub->where('user_id', $targetId)
                        ->where('commentable_type', User::class)
                        ->where('commentable_id', $userId);
                });
            });
        } else {
            // LÓGICA NORMAL PARA ENTIDADES (Créditos, Leads, etc.)
            $query->where('commentable_type', $type)
                ->where('commentable_id', $targetId);
        }

        $comments = $query->with(['user:id,name,email', 'replies.user:id,name'])
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($comments);
    }

    // POST /api/comments
    public function store(Request $request)
    {
        $request->validate([
            'commentable_type' => 'required|string',
            'commentable_id'   => 'required',
            'body'             => 'required|string|max:5000',
            'mentions'         => 'nullable|array',
            'parent_id'        => 'nullable|integer|exists:comments,id',
            'comment_type'     => 'nullable|string',
            'metadata'         => 'nullable|array',
        ]);

        $type = $this->typeMap[$request->commentable_type] ?? $request->commentable_type;

        $comment = Comment::create([
            'parent_id'        => $request->parent_id,
            'commentable_type' => $type,
            'commentable_id'   => $request->commentable_id,
            'user_id'          => $request->user()->id,
            'body'             => $request->body,
            'mentions'         => $request->mentions,
            'comment_type'     => $request->comment_type ?? 'comment',
            'metadata'         => $request->metadata,
        ]);

        $this->logActivity('create', 'Comentarios', $comment, 'Comentario #' . $comment->id, [], $request);

        // Unarchive parent if this reply mentions someone
        if ($request->parent_id) {
            $parent = Comment::find($request->parent_id);
            if ($parent && $parent->archived_at) {
                $parent->update(['archived_at' => null]);
            }
        }

        // Create notifications for mentioned users
        if ($request->mentions) {
            $entityRef = $comment->entity_reference;
            foreach ($request->mentions as $mention) {
                if (($mention['type'] ?? '') === 'user' && $mention['id'] !== $request->user()->id) {
                    $truncatedBody = \Illuminate\Support\Str::limit($request->body, 120);
                    Notification::create([
                        'user_id' => $mention['id'],
                        'type'    => 'comment_mention',
                        'title'   => 'Te mencionaron en un comentario',
                        'body'    => $request->user()->name . ': ' . $truncatedBody,
                        'data'    => [
                            'comment_id'        => $comment->id,
                            'commentable_type'  => $request->commentable_type,
                            'commentable_id'    => $request->commentable_id,
                            'sender_name'       => $request->user()->name,
                            'comment_body'      => $truncatedBody,
                            'entity_reference'  => $entityRef,
                        ],
                    ]);
                }
            }
        }

        // Auto-notify recipient of direct messages
        if ($request->commentable_type === 'direct' || $type === User::class) {
            $recipientId = (int) $request->commentable_id;
            if ($recipientId !== $request->user()->id) {
                $truncatedBody = \Illuminate\Support\Str::limit($request->body, 120);
                Notification::create([
                    'user_id' => $recipientId,
                    'type'    => 'direct_message',
                    'title'   => 'Nuevo mensaje directo',
                    'body'    => $request->user()->name . ': ' . $truncatedBody,
                    'data'    => [
                        'comment_id'   => $comment->id,
                        'sender_id'    => $request->user()->id,
                        'sender_name'  => $request->user()->name,
                        'comment_body' => $truncatedBody,
                    ],
                ]);
            }
        }

        $comment->load('user:id,name,email');

        return response()->json($comment, 201);
    }

    // DELETE /api/comments/{id}
    public function destroy(Request $request, int $id)
    {
        $comment = Comment::findOrFail($id);

        if ($comment->user_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        $this->logActivity('delete', 'Comentarios', $comment, 'Comentario #' . $comment->id, null, $request);

        $comment->delete();

        return response()->json(['message' => 'Comentario eliminado']);
    }

    // PATCH /api/comments/{id}/archive
    public function archive(Request $request, int $id)
    {
        $comment = Comment::roots()->findOrFail($id);

        if ($comment->user_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        $comment->update(['archived_at' => Carbon::now()]);

        return response()->json(['message' => 'Archivado']);
    }

    // PATCH /api/comments/{id}/unarchive
    public function unarchive(Request $request, int $id)
    {
        $comment = Comment::findOrFail($id);
        $comment->update(['archived_at' => null]);

        return response()->json(['message' => 'Desarchivado']);
    }

    // PATCH /api/comments/{id}/star
    public function star(int $id)
    {
        $comment = Comment::findOrFail($id);
        $comment->update(['is_starred' => true]);
        return response()->json(['message' => 'Marcado como importante']);
    }

    // PATCH /api/comments/{id}/unstar
    public function unstar(int $id)
    {
        $comment = Comment::findOrFail($id);
        $comment->update(['is_starred' => false]);
        return response()->json(['message' => 'Quitado de importantes']);
    }

    // PATCH /api/comments/{id}/pending
    public function markPending(int $id)
    {
        $comment = Comment::findOrFail($id);
        $comment->update(['is_pending' => true]);
        return response()->json(['message' => 'Marcado como pendiente']);
    }

    // PATCH /api/comments/{id}/unpending
    public function unmarkPending(int $id)
    {
        $comment = Comment::findOrFail($id);
        $comment->update(['is_pending' => false]);
        return response()->json(['message' => 'Quitado de pendientes']);
    }

    // GET /api/comments/recent
    public function recent(Request $request)
    {
        $userId       = $request->user()?->id;
        $showArchived = filter_var($request->query('archived', false), FILTER_VALIDATE_BOOLEAN);
        $showStarred  = filter_var($request->query('starred', false), FILTER_VALIDATE_BOOLEAN);
        $showPending  = filter_var($request->query('pending', false), FILTER_VALIDATE_BOOLEAN);

        $query = Comment::roots();

        if ($showStarred) {
            $query->where('is_starred', true)->whereNull('archived_at');
        } elseif ($showPending) {
            $query->where('is_pending', true)->whereNull('archived_at');
        } elseif ($showArchived) {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }

        // FILTRAR POR SEGURIDAD: Los mensajes directos solo para sus dueños
        $query->where(function($q) use ($userId) {
            $q->where('commentable_type', '!=', User::class)
              ->orWhere(function($sub) use ($userId) {
                  $sub->where('commentable_type', User::class)
                      ->where(function($inner) use ($userId) {
                          $inner->where('user_id', $userId)
                                ->orWhere('commentable_id', $userId);
                      });
              });
        });

        $comments = $query
            ->with([
                'user:id,name',
                'replies.user:id,name',
                'commentable',
            ])
            ->orderBy('created_at', 'desc')
            ->limit(30)
            ->get()
            ->map(function (Comment $c) {
                $c->entity_reference = $c->entity_reference;
                return $c;
            });

        return response()->json($comments);
    }
}
