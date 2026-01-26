// Reward User - Perfil de gamificación
export interface RewardUser {
  id: number;
  userId: number;
  level: number;
  experiencePoints: number;
  totalPoints: number;
  lifetimePoints: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: string | null;
  streakUpdatedAt: string | null;
  preferences: Record<string, unknown> | null;
}

// Badge Category
export interface BadgeCategory {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
}

// Badge
export interface Badge {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string | null;
  rarity: BadgeRarity;
  pointsReward: number;
  xpReward: number;
  isSecret: boolean;
  earnedAt?: string;
  progress?: number;
}

export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Transaction
export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  balanceAfter: number;
  createdAt: string;
}

export type TransactionType = 
  | 'earn' 
  | 'spend' 
  | 'bonus' 
  | 'expire' 
  | 'badge_reward' 
  | 'challenge_reward';

// Challenge
export interface Challenge {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: ChallengeType;
  objectives: ChallengeObjective[];
  rewards: ChallengeRewards;
  startDate: string;
  endDate: string;
  maxParticipants: number | null;
  participantsCount: number;
  isActive: boolean;
  isJoined: boolean;
  isCompleted: boolean;
  progress?: ChallengeProgress;
}

export type ChallengeType = 'individual' | 'team' | 'competitive';

export interface ChallengeObjective {
  key: string;
  name: string;
  description?: string;
  type: string;
  target: number;
  current?: number;
  completed?: boolean;
  progress?: number;
}

export interface ChallengeRewards {
  points?: number;
  xp?: number;
  badges?: number[];
}

export interface ChallengeProgress {
  isCompleted: boolean;
  completedAt: string | null;
  joinedAt: string;
  overallProgress: number;
  completedObjectives: number;
  totalObjectives: number;
  objectives: Record<string, ChallengeObjective>;
  rewardsClaimed: ChallengeRewards | null;
}

export interface ChallengeParticipation {
  challengeId: number;
  joinedAt: string;
  completedAt: string | null;
  progress: Record<string, { current: number; target: number; completed: boolean }>;
  rewardsClaimed: ChallengeRewards | null;
}

// Catalog
export interface CatalogItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: CatalogCategory;
  cost: number;
  currency: string;
  stock: number | null; // -1 or null = unlimited
  imageUrl: string | null;
  levelRequired: number;
  availableFrom: string | null;
  availableUntil: string | null;
  isActive: boolean;
  canRedeem: boolean;
  reason?: string;
  // Alternative property names for API compatibility
  pointsCost?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  requirements?: {
    minLevel?: number;
    badgeId?: number;
  };
}

export type CatalogCategory = 'digital' | 'physical' | 'experience' | 'donation';

// Redemption
export interface Redemption {
  id: number;
  item: {
    id: number;
    name: string;
    imageUrl: string | null;
    category: string;
  };
  pointsSpent: number;
  status: RedemptionStatus;
  notes: string | null;
  createdAt: string;
  approvedAt: string | null;
  deliveredAt: string | null;
  // Alternative property name for API compatibility
  catalogItem?: {
    id: number;
    name: string;
    imageUrl: string | null;
    category: string;
  };
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'delivered' | 'cancelled';

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
    level: number;
  };
  value: number;
  change?: number;
  // Alternative property names for API compatibility
  level?: number;
  rankChange?: number;
  score?: number;
}

export interface LeaderboardData {
  metric: string;
  period: string;
  entries: LeaderboardEntry[];
  generatedAt: string;
}

export interface UserLeaderboardPosition {
  position: number;
  value: number;
  totalParticipants: number;
  percentile: number;
}

// Daily Task
export interface DailyTask {
  id: string;
  name: string;
  description: string;
  points: number;
  xp: number;
  completed: boolean;
  progress: number;
  target: number;
}

// Dashboard
export interface DashboardData {
  summary: UserSummary;
  badges: {
    earned: Badge[];
    available: Badge[];
  };
  recentActivity: Transaction[];
}

export interface UserSummary {
  level: number;
  experiencePoints: number;
  xpForNextLevel: number;
  totalPoints: number;
  lifetimePoints: number;
  currentStreak: number;
  longestStreak: number;
  badgesCount: number;
  lastActivityAt: string | null;
}

// Profile response
export interface ProfileData {
  user: {
    id: number;
    name: string;
    email: string;
  };
  gamification: UserSummary;
  recentBadges: Badge[];
}

// Balance response
export interface BalanceData {
  totalPoints: number;
  lifetimePoints: number;
  level: number;
  experiencePoints: number;
}

// Streak info
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
  lastActivity: string | null;
  streakBonusPercent: number;
  willExpireAt: string | null;
  hoursRemaining: number | null;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}
