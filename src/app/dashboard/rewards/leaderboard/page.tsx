"use client";

import { useState } from "react";
import { useLeaderboard, useMyLeaderboardPosition, useLeaderboardStats, type LeaderboardMetric, type LeaderboardPeriod, type LeaderboardData } from "@/hooks/use-leaderboard";
import type { LeaderboardEntry } from "@/types/rewards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Star,
  Flame,
  Zap,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const metricConfig = {
  points: { label: "Puntos", icon: Star, color: "text-amber-500" },
  experience: { label: "Experiencia", icon: Zap, color: "text-purple-500" },
  streak: { label: "Racha", icon: Flame, color: "text-orange-500" },
  level: { label: "Nivel", icon: Trophy, color: "text-blue-500" },
};

const periodConfig = {
  daily: { label: "Hoy" },
  weekly: { label: "Esta semana" },
  monthly: { label: "Este mes" },
  all_time: { label: "Todos los tiempos" },
};

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-amber-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-700" />;
    default:
      return null;
  }
}

function getRankChange(change: number) {
  if (change > 0) {
    return (
      <div className="flex items-center text-green-500 text-xs">
        <TrendingUp className="h-3 w-3 mr-0.5" />
        {change}
      </div>
    );
  } else if (change < 0) {
    return (
      <div className="flex items-center text-red-500 text-xs">
        <TrendingDown className="h-3 w-3 mr-0.5" />
        {Math.abs(change)}
      </div>
    );
  }
  return (
    <div className="flex items-center text-muted-foreground text-xs">
      <Minus className="h-3 w-3" />
    </div>
  );
}

function LeaderboardRow({ 
  entry, 
  rank, 
  isCurrentUser,
  metric,
}: { 
  entry: LeaderboardEntry; 
  rank: number;
  isCurrentUser: boolean;
  metric: string;
}) {
  const metricInfo = metricConfig[metric as keyof typeof metricConfig] || metricConfig.points;
  const MetricIcon = metricInfo.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg transition-colors",
        isCurrentUser 
          ? "bg-primary/10 ring-1 ring-primary/20" 
          : "hover:bg-muted/50",
        rank <= 3 && "border-l-4",
        rank === 1 && "border-l-amber-500",
        rank === 2 && "border-l-gray-400",
        rank === 3 && "border-l-amber-700"
      )}
    >
      {/* Rank */}
      <div className="flex items-center justify-center w-10">
        {getRankIcon(rank) || (
          <span className={cn(
            "text-lg font-bold",
            rank <= 10 ? "text-foreground" : "text-muted-foreground"
          )}>
            {rank}
          </span>
        )}
      </div>

      {/* User Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 border-2 border-background shadow">
          <AvatarImage src={entry.user?.avatar ?? undefined} />
          <AvatarFallback>
            {entry.user?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className={cn(
            "font-medium truncate",
            isCurrentUser && "text-primary"
          )}>
            {entry.user?.name || "Usuario"}
            {isCurrentUser && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Tú
              </Badge>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Nivel {entry.level || 1}
          </p>
        </div>
      </div>

      {/* Rank Change */}
      <div className="hidden sm:block">
        {getRankChange(entry.rankChange || 0)}
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 text-right">
        <MetricIcon className={cn("h-4 w-4", metricInfo.color)} />
        <span className="font-bold text-lg">
          {entry.score?.toLocaleString() || 0}
        </span>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function MyPositionCard({ metric, period }: { metric: LeaderboardMetric; period: LeaderboardPeriod }) {
  const { position, isLoading } = useMyLeaderboardPosition(metric, period);
  const metricInfo = metricConfig[metric as keyof typeof metricConfig] || metricConfig.points;
  const MetricIcon = metricInfo.icon;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tu posición</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                #{position?.position || "-"}
              </span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">{metricInfo.label}</p>
            <div className="flex items-center gap-1 justify-end">
              <MetricIcon className={cn("h-4 w-4", metricInfo.color)} />
              <span className="text-xl font-bold">
                {position?.value?.toLocaleString() || 0}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCards({ metric, period }: { metric: LeaderboardMetric; period: LeaderboardPeriod }) {
  const { stats, isLoading } = useLeaderboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const userPosition = stats?.[metric]?.[period];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Participantes</p>
          <p className="text-2xl font-bold">{userPosition?.totalParticipants || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Tu valor</p>
          <p className="text-2xl font-bold">{(userPosition?.value || 0).toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Tu posición</p>
          <p className="text-2xl font-bold">#{userPosition?.position || "-"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Tu percentil</p>
          <p className="text-2xl font-bold">Top {userPosition?.percentile || 100}%</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<LeaderboardMetric>("points");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");

  const { ranking, isLoading, error } = useLeaderboard({ metric, period, limit: 50 });
  
  // Simular usuario actual - esto vendría del contexto de auth
  const currentUserId = 1;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs value={metric} onValueChange={(value) => setMetric(value as LeaderboardMetric)} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(metricConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className="hidden sm:inline">{config.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* My Position */}
      <MyPositionCard metric={metric} period={period} />

      {/* Stats */}
      <StatsCards metric={metric} period={period} />

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Clasificación - {metricConfig[metric as keyof typeof metricConfig]?.label}
              </CardTitle>
              <CardDescription>
                {periodConfig[period as keyof typeof periodConfig]?.label}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {ranking?.entries?.length || 0} jugadores
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              Error al cargar el leaderboard
            </div>
          ) : !ranking?.entries?.length ? (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay datos disponibles</p>
              <p className="text-sm text-muted-foreground mt-1">
                ¡Sé el primero en aparecer en el leaderboard!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ranking.entries.map((entry: LeaderboardEntry, index: number) => (
                <LeaderboardRow
                  key={entry.user?.id || index}
                  entry={entry}
                  rank={index + 1}
                  isCurrentUser={entry.user?.id === currentUserId}
                  metric={metric}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
