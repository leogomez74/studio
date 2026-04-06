"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
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
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useRewardsDashboard, useRewardsAnalytics } from "@/hooks/use-rewards";
import type { WeeklyActivity, TopAction, BadgeDistribution } from "@/hooks/use-rewards";
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
// Default data for charts (when no real data)
// ============================================

function getDefaultWeeklyActivity(): WeeklyActivity[] {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const today = new Date();
  return days.map((day, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return {
      day,
      date: date.toISOString().split('T')[0],
      points: 0,
      badges: 0,
      challenges: 0,
    };
  });
}

function getDefaultTopActions(): TopAction[] {
  return [
    { action: 'lead_created', label: 'Crear Lead', count: 0, points: 0 },
    { action: 'opportunity_won', label: 'Ganar Oportunidad', count: 0, points: 0 },
    { action: 'credit_approved', label: 'Aprobar Crédito', count: 0, points: 0 },
    { action: 'payment_registered', label: 'Registrar Pago', count: 0, points: 0 },
    { action: 'daily_login', label: 'Login Diario', count: 0, points: 0 },
  ];
}

function getDefaultBadgeDistribution(): BadgeDistribution[] {
  return [
    { rarity: 'common', count: 0, percentage: 0 },
    { rarity: 'uncommon', count: 0, percentage: 0 },
    { rarity: 'rare', count: 0, percentage: 0 },
    { rarity: 'epic', count: 0, percentage: 0 },
    { rarity: 'legendary', count: 0, percentage: 0 },
  ];
}

// ============================================
// Chart Configs
// ============================================

const activityChartConfig = {
  points: { label: 'Puntos', color: 'hsl(var(--chart-1))' },
  badges: { label: 'Badges', color: 'hsl(var(--chart-2))' },
  challenges: { label: 'Desafíos', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

const actionsChartConfig = {
  points: { label: 'Puntos', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const badgeChartConfig = {
  count: { label: 'Badges' },
  common: { label: 'Común', color: '#9ca3af' },
  uncommon: { label: 'Poco común', color: '#22c55e' },
  rare: { label: 'Raro', color: '#3b82f6' },
  epic: { label: 'Épico', color: '#a855f7' },
  legendary: { label: 'Legendario', color: '#eab308' },
} satisfies ChartConfig;

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

// ============================================
// Weekly Activity Chart
// ============================================
function WeeklyActivityChart({ data }: { data: WeeklyActivity[] }) {
  const chartData = data.length > 0 ? data : getDefaultWeeklyActivity();
  const hasData = data.some(d => d.points > 0 || d.badges > 0 || d.challenges > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Actividad Semanal
        </CardTitle>
        <Link href="/dashboard/rewards/analytics">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver analytics <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={activityChartConfig} className="h-[220px] w-full">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillPoints" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-points)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-points)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={30} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="points"
              stroke="var(--color-points)"
              fill="url(#fillPoints)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
        {!hasData && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Los puntos que ganes aparecerán aquí
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Top Actions Bar Chart
// ============================================
function TopActionsChart({ data }: { data: TopAction[] }) {
  const chartData = data.length > 0 ? data.slice(0, 5) : getDefaultTopActions();
  const hasData = data.some(d => d.points > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-green-500" />
          Top Acciones
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={actionsChartConfig} className="h-[200px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              width={100}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="points" fill="var(--color-points)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
        {!hasData && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Completa acciones en el CRM para ver tu progreso
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Badge Distribution Donut Chart
// ============================================
function BadgeDistributionChart({ data }: { data: BadgeDistribution[] }) {
  const chartData = data.length > 0 ? data : getDefaultBadgeDistribution();
  const hasData = data.some(d => d.count > 0);
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  // Show placeholder ring if no data
  const displayData = hasData
    ? chartData.filter(d => d.count > 0)
    : [{ rarity: 'empty', count: 1, percentage: 100 }];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-purple-500" />
          Distribución de Badges
        </CardTitle>
        <Link href="/dashboard/rewards/badges">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver todos <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={badgeChartConfig} className="h-[180px] w-full">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={hasData ? <ChartTooltipContent nameKey="rarity" /> : undefined}
            />
            <Pie
              data={displayData}
              dataKey="count"
              nameKey="rarity"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              strokeWidth={2}
            >
              {displayData.map((entry) => (
                <Cell
                  key={entry.rarity}
                  fill={hasData ? (RARITY_COLORS[entry.rarity] || '#9ca3af') : '#e5e7eb'}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {hasData ? (
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            {chartData.filter(d => d.count > 0).map((d) => (
              <div key={d.rarity} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: RARITY_COLORS[d.rarity] || '#9ca3af' }}
                />
                <span className="text-muted-foreground capitalize">{d.rarity}</span>
                <span className="font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center mt-1">
            <p className="text-lg font-bold text-muted-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">badges obtenidos</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Loading Skeleton
// ============================================
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6">
          <Skeleton className="h-16 w-48 bg-white/20" />
        </div>
        <CardContent className="p-4"><Skeleton className="h-3 w-full" /></CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-[220px] w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
        </div>
        <div className="space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-[180px] w-full" /></CardContent></Card>
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
// GamificationDashboard — dashboard + analytics
// ============================================
export function GamificationDashboard() {
  const { data, isLoading } = useRewardsDashboard();
  const { data: analytics } = useRewardsAnalytics('week');

  if (isLoading || !data || !data.summary) {
    return <DashboardSkeleton />;
  }

  const summary = data.summary;
  const leaderboardEntries = data.leaderboard?.entries || [];
  const challenges = data.challenges || [];
  const recentActivity = data.recentActivity || data.recent_activity || [];
  const availableBadges = data.badges?.available || [];

  const weeklyActivity = analytics?.weekly_activity || [];
  const topActions = analytics?.top_actions || [];
  const badgeDistribution = analytics?.badge_distribution || [];

  const currentUserId = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('dsf.user.id') || '0', 10) || undefined
    : undefined;

  return (
    <div className="space-y-6">
      {/* Hero: Nivel + Puntos + Racha */}
      <HeroCard summary={summary} />

      {/* 4 stats rápidas */}
      <QuickStats summary={summary} />

      {/* Charts + Sidebar: 3 columnas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal — Gráficos + Contenido */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actividad semanal */}
          <WeeklyActivityChart data={weeklyActivity} />

          {/* Top acciones */}
          <TopActionsChart data={topActions} />

          {/* Desafíos activos */}
          <ActiveChallenges challenges={challenges} />

          {/* Actividad reciente */}
          <RecentActivity transactions={recentActivity} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Distribución de badges */}
          <BadgeDistributionChart data={badgeDistribution} />

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
