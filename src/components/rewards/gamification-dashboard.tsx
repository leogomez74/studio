"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Flame,
  Star,
  ChevronRight,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  Gift,
  Clock
} from "lucide-react";
import Link from "next/link";
import { useRewardsDashboard } from "@/hooks/use-rewards";
import type {
  UserSummary,
  Badge as BadgeType,
  LeaderboardEntry,
  Transaction,
  Challenge,
} from "@/types/rewards";

// ============================================
// Helpers
// ============================================

function calculateXPForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level + 1, 1.5));
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'bg-gray-100 text-gray-800 border-gray-300',
    uncommon: 'bg-green-100 text-green-800 border-green-300',
    rare: 'bg-blue-100 text-blue-800 border-blue-300',
    epic: 'bg-purple-100 text-purple-800 border-purple-300',
    legendary: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };
  return colors[rarity] || colors.common;
}

function getRankStyle(rank: number): string {
  if (rank === 1) return 'text-yellow-500 font-bold';
  if (rank === 2) return 'text-gray-400 font-bold';
  if (rank === 3) return 'text-amber-600 font-bold';
  return 'text-muted-foreground';
}

function getRankIcon(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

// ============================================
// Loading Skeleton
// ============================================
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
        <div className="space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Hero Card — Perfil + Nivel + Racha
// ============================================
function HeroCard({ summary }: { summary: UserSummary }) {
  const xpForNext = summary.xpForNextLevel || calculateXPForNextLevel(summary.level);
  const xpProgress = Math.min((summary.experiencePoints / xpForNext) * 100, 100);

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              <Star className="h-8 w-8" />
            </div>
            <div>
              <div className="text-sm opacity-90">Nivel {summary.level}</div>
              <div className="text-3xl font-bold">{summary.totalPoints.toLocaleString()} pts</div>
              <div className="text-sm opacity-80">
                {summary.lifetimePoints.toLocaleString()} puntos en total
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Flame className={`h-6 w-6 ${summary.currentStreak > 0 ? 'text-yellow-200' : 'text-white/40'}`} />
              <span className="text-2xl font-bold">{summary.currentStreak}</span>
            </div>
            <div className="text-sm opacity-80">
              {summary.currentStreak === 1 ? 'día' : 'días'} de racha
            </div>
            {summary.longestStreak > summary.currentStreak && (
              <div className="text-xs opacity-60 mt-0.5">
                Récord: {summary.longestStreak} días
              </div>
            )}
          </div>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">
            XP: {summary.experiencePoints.toLocaleString()} / {xpForNext.toLocaleString()}
          </span>
          <span className="font-medium text-primary">
            Nivel {summary.level + 1}
          </span>
        </div>
        <Progress value={xpProgress} className="h-2.5" />
      </CardContent>
    </Card>
  );
}

// ============================================
// Stats Cards — 4 métricas rápidas
// ============================================
function QuickStats({ summary }: { summary: UserSummary }) {
  const stats = [
    { label: 'Puntos', value: summary.totalPoints.toLocaleString(), icon: <Zap className="h-5 w-5 text-primary" />, color: 'bg-primary/10' },
    { label: 'Nivel', value: summary.level, icon: <Star className="h-5 w-5 text-yellow-500" />, color: 'bg-yellow-50' },
    { label: 'Badges', value: summary.badgesCount, icon: <Award className="h-5 w-5 text-purple-500" />, color: 'bg-purple-50' },
    { label: 'Racha', value: `${summary.currentStreak}d`, icon: <Flame className="h-5 w-5 text-orange-500" />, color: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.color}`}>{stat.icon}</div>
            <div>
              <div className="text-2xl font-bold leading-none">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// Mini Leaderboard
// ============================================
function MiniLeaderboard({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking Semanal
        </CardTitle>
        <Link href="/dashboard/rewards/leaderboard">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver todo <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length > 0 ? entries.slice(0, 5).map((entry) => {
          if (!entry?.user) return null;
          const isMe = currentUserId === entry.user.id;
          return (
            <div
              key={entry.user.id}
              className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
                isMe ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/50'
              }`}
            >
              <span className={`w-6 text-center text-sm ${getRankStyle(entry.rank)}`}>
                {getRankIcon(entry.rank) || entry.rank}
              </span>
              <Avatar className="h-7 w-7">
                <AvatarImage src={entry.user.avatar || undefined} />
                <AvatarFallback className="text-xs">{entry.user.name?.[0] || '?'}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm truncate">
                {entry.user.name || 'Usuario'}
                {isMe && <span className="text-xs text-primary ml-1">(tú)</span>}
              </span>
              <span className="font-semibold text-sm">{entry.value?.toLocaleString() || '0'}</span>
            </div>
          );
        }) : (
          <p className="text-center py-4 text-sm text-muted-foreground">Sin datos aún</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Active Challenges
// ============================================
function ActiveChallenges({ challenges }: { challenges: Challenge[] }) {
  const active = challenges.filter(c => c.isJoined && !c.isCompleted).slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          Desafíos Activos
        </CardTitle>
        <Link href="/dashboard/rewards/challenges">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver todos <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {active.length > 0 ? active.map((ch) => {
          const progress = ch.progress?.overallProgress || 0;
          const daysLeft = Math.ceil((new Date(ch.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return (
            <Link key={ch.id} href={`/dashboard/rewards/challenges`} className="block p-3 border rounded-lg mb-2 last:mb-0 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-sm">{ch.name}</span>
                <Badge variant="outline" className="text-xs">
                  {daysLeft > 0 ? `${daysLeft}d` : 'Hoy'}
                </Badge>
              </div>
              <Progress value={progress * 100} className="h-1.5" />
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{Math.round(progress * 100)}%</span>
                {ch.rewards.points && <span>+{ch.rewards.points} pts</span>}
              </div>
            </Link>
          );
        }) : (
          <div className="text-center py-6">
            <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Sin desafíos activos</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/rewards/challenges">Explorar</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Upcoming Badges
// ============================================
function UpcomingBadges({ badges }: { badges: BadgeType[] }) {
  const sorted = badges
    .filter(b => (b.progress || 0) > 0 && (b.progress || 0) < 1)
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-5 w-5 text-purple-500" />
          Próximos Badges
        </CardTitle>
        <Link href="/dashboard/rewards/badges">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver todos <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {sorted.length > 0 ? sorted.map((badge) => (
          <div key={badge.id} className="flex items-center gap-3 py-2">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
              {badge.icon || <Award className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{badge.name}</span>
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getRarityColor(badge.rarity)}`}>
                  {badge.rarity}
                </Badge>
              </div>
              <Progress value={(badge.progress || 0) * 100} className="h-1.5 mt-1" />
            </div>
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              {Math.round((badge.progress || 0) * 100)}%
            </span>
          </div>
        )) : (
          <p className="text-center py-4 text-sm text-muted-foreground">Sin badges en progreso</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Recent Activity
// ============================================
function RecentActivity({ transactions }: { transactions: Transaction[] }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'earn': case 'badge_reward': case 'challenge_reward':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'spend':
        return <Gift className="h-4 w-4 text-blue-500" />;
      case 'bonus':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {transactions.length > 0 ? transactions.slice(0, 6).map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {getIcon(t.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{t.description || t.type}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleDateString()}
              </div>
            </div>
            <span className={`font-semibold text-sm shrink-0 ${
              t.amount > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
            </span>
          </div>
        )) : (
          <p className="text-center py-4 text-sm text-muted-foreground">
            Completa acciones en el CRM para empezar a ganar puntos
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// GamificationDashboard — 1 solo request
// ============================================
export function GamificationDashboard() {
  // Un solo request consolidado: summary + badges + leaderboard + challenges + actividad
  const { data, isLoading } = useRewardsDashboard();

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const summary = data.summary;
  const leaderboardEntries = data.leaderboard?.entries || [];
  const challenges = data.challenges || [];
  const recentActivity = data.recentActivity || data.recent_activity || [];
  const availableBadges = data.badges?.available || [];

  const currentUserId = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('dsf.user.id') || '0', 10) || undefined
    : undefined;

  return (
    <div className="space-y-6">
      {/* Hero: Nivel + Puntos + Racha */}
      <HeroCard summary={summary} />

      {/* 4 stats rápidas */}
      <QuickStats summary={summary} />

      {/* Layout 3 columnas: contenido principal (2) + sidebar (1) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Desafíos activos */}
          <ActiveChallenges challenges={challenges} />

          {/* Actividad reciente */}
          <RecentActivity transactions={recentActivity} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ranking */}
          <MiniLeaderboard entries={leaderboardEntries} currentUserId={currentUserId} />

          {/* Próximos badges */}
          <UpcomingBadges badges={availableBadges} />

          {/* CTA Catálogo */}
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
            <CardContent className="p-5 text-center">
              <Gift className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-semibold text-sm mb-1">Canjea tus puntos</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Tienes {summary.totalPoints.toLocaleString()} puntos disponibles
              </p>
              <Button variant="outline" size="sm" asChild className="border-purple-200 hover:bg-purple-50">
                <Link href="/dashboard/rewards/catalog">Ver catálogo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Re-export individual components for backward compat with other pages
export function ProfileCard({ profile, isLoading: loading }: { profile: UserSummary & { name?: string; avatar?: string }; isLoading?: boolean }) {
  if (loading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>;
  }
  return <HeroCard summary={profile} />;
}

export function StreakCard({ streak, isLoading: loading }: { streak: { current: number; longest: number; isActiveToday?: boolean; streakBonusPercent?: number }; isLoading?: boolean }) {
  if (loading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${streak.isActiveToday ? 'bg-orange-100' : 'bg-muted'}`}>
              <Flame className={`h-8 w-8 ${streak.isActiveToday ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <div className="text-2xl font-bold">{streak.current} {streak.current === 1 ? 'día' : 'días'}</div>
              <div className="text-sm text-muted-foreground">Récord: {streak.longest} días</div>
            </div>
          </div>
          {streak.streakBonusPercent && streak.streakBonusPercent > 0 && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">+{streak.streakBonusPercent}% bonus</Badge>
          )}
        </div>
        {!streak.isActiveToday && streak.current > 0 && (
          <div className="mt-3 text-xs text-amber-600 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ¡Completa una actividad hoy para mantener tu racha!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PointsCard({ points, lifetimePoints, isLoading: loading }: { points: number; lifetimePoints: number; isLoading?: boolean }) {
  if (loading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Zap className="h-8 w-8 text-primary" /></div>
          <div>
            <div className="text-2xl font-bold text-primary">{points.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">puntos disponibles</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          Total histórico: {lifetimePoints.toLocaleString()} puntos
        </div>
      </CardContent>
    </Card>
  );
}

export function BadgeCard({ badge, showProgress = false }: { badge: BadgeType; showProgress?: boolean }) {
  const isEarned = !!badge.earnedAt;
  const progress = badge.progress || 0;
  return (
    <div className={`p-4 rounded-lg border transition-all ${isEarned ? 'bg-card hover:shadow-md' : 'bg-muted/30 opacity-75 hover:opacity-100'}`}>
      <div className="flex items-start gap-3">
        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl ${isEarned ? 'bg-primary/10' : 'bg-muted'}`}>
          {badge.icon || <Award className={`h-6 w-6 ${isEarned ? 'text-primary' : 'text-muted-foreground'}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium truncate ${!isEarned && 'text-muted-foreground'}`}>{badge.name}</h4>
            <Badge variant="outline" className={`text-xs ${getRarityColor(badge.rarity)}`}>{badge.rarity}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{badge.description}</p>
          {showProgress && !isEarned && (
            <div className="mt-2">
              <Progress value={progress * 100} className="h-1.5" />
              <span className="text-xs text-muted-foreground">{Math.round(progress * 100)}%</span>
            </div>
          )}
          {isEarned && badge.earnedAt && (
            <div className="text-xs text-green-600 mt-1">
              Obtenido el {new Date(badge.earnedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
      {(badge.pointsReward > 0 || badge.xpReward > 0) && (
        <div className="mt-2 pt-2 border-t flex gap-3 text-xs text-muted-foreground">
          {badge.pointsReward > 0 && <span>+{badge.pointsReward} puntos</span>}
          {badge.xpReward > 0 && <span>+{badge.xpReward} XP</span>}
        </div>
      )}
    </div>
  );
}
