"use client";

import { useState } from "react";
import { useBadges, useBadgeProgress } from "@/hooks/use-rewards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Medal, Lock, CheckCircle2, Star, Sparkles } from "lucide-react";
import { Badge as BadgeType } from "@/types/rewards";
import { cn } from "@/lib/utils";

const rarityConfig = {
  common: { label: "Común", color: "bg-gray-500", textColor: "text-gray-500" },
  uncommon: { label: "Poco común", color: "bg-green-500", textColor: "text-green-500" },
  rare: { label: "Raro", color: "bg-blue-500", textColor: "text-blue-500" },
  epic: { label: "Épico", color: "bg-purple-500", textColor: "text-purple-500" },
  legendary: { label: "Legendario", color: "bg-amber-500", textColor: "text-amber-500" },
};

function BadgeCard({ 
  badge, 
  isEarned, 
  progress,
  onClick 
}: { 
  badge: BadgeType; 
  isEarned: boolean;
  progress?: number;
  onClick: () => void;
}) {
  const rarity = rarityConfig[badge.rarity as keyof typeof rarityConfig] || rarityConfig.common;
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1",
        isEarned ? "ring-2 ring-primary/50" : "opacity-75 hover:opacity-100"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Badge Icon */}
          <div className={cn(
            "relative w-16 h-16 rounded-full flex items-center justify-center",
            isEarned 
              ? `${rarity.color} text-white` 
              : "bg-muted text-muted-foreground"
          )}>
            {badge.icon ? (
              <span className="text-2xl">{badge.icon}</span>
            ) : (
              <Medal className="h-8 w-8" />
            )}
            
            {/* Earned indicator */}
            {isEarned && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <CheckCircle2 className="h-3 w-3 text-white" />
              </div>
            )}
            
            {/* Lock indicator */}
            {!isEarned && badge.isSecret && (
              <div className="absolute -bottom-1 -right-1 bg-muted-foreground rounded-full p-1">
                <Lock className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          {/* Badge Name */}
          <div>
            <h3 className="font-semibold text-sm line-clamp-1">
              {badge.isSecret && !isEarned ? "???" : badge.name}
            </h3>
            <Badge variant="outline" className={cn("text-xs mt-1", rarity.textColor)}>
              {rarity.label}
            </Badge>
          </div>

          {/* Progress */}
          {!isEarned && progress !== undefined && progress > 0 && (
            <div className="w-full">
              <Progress value={progress} className="h-1.5" />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          )}

          {/* Rewards */}
          {(badge.pointsReward || badge.xpReward) && (
            <div className="flex gap-2 text-xs text-muted-foreground">
              {badge.pointsReward && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" />
                  {badge.pointsReward}
                </span>
              )}
              {badge.xpReward && (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  {badge.xpReward} XP
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BadgeDetailDialog({ 
  badge, 
  isEarned,
  earnedAt,
  open, 
  onClose 
}: { 
  badge: BadgeType | null; 
  isEarned: boolean;
  earnedAt?: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!badge) return null;
  
  const rarity = rarityConfig[badge.rarity as keyof typeof rarityConfig] || rarityConfig.common;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center",
              isEarned ? rarity.color : "bg-muted",
              "text-white"
            )}>
              {badge.icon ? (
                <span className="text-3xl">{badge.icon}</span>
              ) : (
                <Medal className="h-10 w-10" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">{badge.name}</DialogTitle>
              <Badge variant="outline" className={rarity.textColor}>
                {rarity.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription className="text-base">
            {badge.description}
          </DialogDescription>

          {isEarned && earnedAt && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              <span>Obtenido el {new Date(earnedAt).toLocaleDateString()}</span>
            </div>
          )}

          {(badge.pointsReward || badge.xpReward) && (
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2">Recompensas</h4>
              <div className="flex gap-4">
                {badge.pointsReward && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">{badge.pointsReward}</span>
                    <span className="text-sm text-muted-foreground">puntos</span>
                  </div>
                )}
                {badge.xpReward && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="font-semibold">{badge.xpReward}</span>
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {badge.category && (
            <div className="text-sm text-muted-foreground">
              Categoría: <span className="font-medium">{typeof badge.category === 'string' ? badge.category : badge.category}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BadgesGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center space-y-3">
              <Skeleton className="w-16 h-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function BadgesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { earnedBadges, availableBadges, isLoading: loadingBadges } = useBadges();
  const { progress: progressData } = useBadgeProgress();

  const allBadges: BadgeType[] = [...earnedBadges, ...availableBadges];
  const earnedBadgeIds = new Set(earnedBadges.map((b: BadgeType) => b.id));
  const earnedBadgesMap = new Map(earnedBadges.map((b: BadgeType) => [b.id, b.earnedAt]));

  // Filter badges
  const filteredBadges = allBadges.filter((badge: BadgeType) => {
    const matchesSearch = badge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         badge.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRarity = rarityFilter === "all" || badge.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  });

  // Separate earned and unearned
  const filteredEarnedBadges = filteredBadges.filter((b: BadgeType) => earnedBadgeIds.has(b.id));
  const filteredUnearnedBadges = filteredBadges.filter((b: BadgeType) => !earnedBadgeIds.has(b.id));

  const handleBadgeClick = (badge: BadgeType) => {
    setSelectedBadge(badge);
    setDialogOpen(true);
  };

  const totalBadges = allBadges.length;
  const earnedCount = earnedBadgeIds.size;
  const completionPercent = totalBadges > 0 ? Math.round((earnedCount / totalBadges) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Medal className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Badges Obtenidos</p>
                <p className="text-2xl font-bold">{earnedCount} / {totalBadges}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progreso Total</span>
                <span className="font-medium">{completionPercent}%</span>
              </div>
              <Progress value={completionPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Sparkles className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Por Desbloquear</p>
                <p className="text-2xl font-bold">{totalBadges - earnedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar badges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Rareza" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las rarezas</SelectItem>
            <SelectItem value="common">Común</SelectItem>
            <SelectItem value="uncommon">Poco común</SelectItem>
            <SelectItem value="rare">Raro</SelectItem>
            <SelectItem value="epic">Épico</SelectItem>
            <SelectItem value="legendary">Legendario</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Badges Grid */}
      {loadingBadges ? (
        <BadgesGridSkeleton />
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              Todos ({filteredBadges.length})
            </TabsTrigger>
            <TabsTrigger value="earned">
              Obtenidos ({filteredEarnedBadges.length})
            </TabsTrigger>
            <TabsTrigger value="unearned">
              Por obtener ({filteredUnearnedBadges.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {filteredBadges.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Medal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No se encontraron badges</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredBadges.map((badge: BadgeType) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    isEarned={earnedBadgeIds.has(badge.id)}
                    progress={badge.progress}
                    onClick={() => handleBadgeClick(badge)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="earned">
            {filteredEarnedBadges.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Medal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aún no has obtenido badges</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¡Completa tareas para desbloquear tu primer badge!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredEarnedBadges.map((badge: BadgeType) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    isEarned={true}
                    onClick={() => handleBadgeClick(badge)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="unearned">
            {filteredUnearnedBadges.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">¡Has obtenido todos los badges!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredUnearnedBadges.map((badge: BadgeType) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    isEarned={false}
                    progress={badge.progress}
                    onClick={() => handleBadgeClick(badge)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Badge Detail Dialog */}
      <BadgeDetailDialog
        badge={selectedBadge}
        isEarned={selectedBadge ? earnedBadgeIds.has(selectedBadge.id) : false}
        earnedAt={selectedBadge ? earnedBadgesMap.get(selectedBadge.id) : undefined}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
