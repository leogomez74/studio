'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth';
import type {
  DashboardData,
  ProfileData,
  BalanceData,
  Badge,
  Transaction,
  Challenge,
  ChallengeProgress,
  CatalogItem,
  Redemption,
  ApiResponse,
} from '@/types/rewards';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Helper para hacer peticiones autenticadas
 */
async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('No hay sesión activa');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}`);
  }

  const result = await response.json();
  return result.data ?? result;
}

/**
 * Hook para el dashboard de rewards
 */
export function useRewardsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<DashboardData>('/rewards/dashboard');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}

/**
 * Hook para el perfil de rewards
 */
export function useRewardsProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<ProfileData>('/rewards/profile');
      setProfile(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refetch: fetchProfile };
}

/**
 * Hook para el balance de puntos
 */
export function useRewardsBalance() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<BalanceData>('/rewards/balance');
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}

/**
 * Hook para el historial de transacciones
 */
export function useTransactionHistory(limit: number = 20) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<Transaction[]>(`/rewards/history?limit=${limit}`);
      setTransactions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { transactions, isLoading, error, refetch: fetchHistory };
}

/**
 * Hook para badges
 */
export function useBadges() {
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBadges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [earned, available] = await Promise.all([
        fetchWithAuth<Badge[]>('/rewards/badges'),
        fetchWithAuth<Badge[]>('/rewards/badges/available'),
      ]);

      setEarnedBadges(earned);
      setAvailableBadges(available);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  return { earnedBadges, availableBadges, isLoading, error, refetch: fetchBadges };
}

/**
 * Hook para progreso de badges
 */
export function useBadgeProgress() {
  const [progress, setProgress] = useState<{
    totalBadges: number;
    earnedCount: number;
    earned: Badge[];
    inProgress: Badge[];
    locked: Badge[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<typeof progress>('/rewards/badges/progress');
      setProgress(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return { progress, isLoading, error, refetch: fetchProgress };
}

/**
 * Hook para challenges
 */
export function useChallenges(status: string = 'active') {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChallenges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<Challenge[]>(`/rewards/challenges?status=${status}`);
      setChallenges(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const joinChallenge = useCallback(async (challengeId: number) => {
    try {
      await fetchWithAuth(`/rewards/challenges/${challengeId}/join`, {
        method: 'POST',
      });
      await fetchChallenges();
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error al unirse al desafío' 
      };
    }
  }, [fetchChallenges]);

  return { challenges, isLoading, error, refetch: fetchChallenges, joinChallenge };
}

/**
 * Hook para un challenge específico
 */
export function useChallengeDetail(challengeId: number | null | undefined) {
  const [data, setData] = useState<{ challenge: Challenge | null; progress: ChallengeProgress | null }>({
    challenge: null,
    progress: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchChallenge = useCallback(async () => {
    // Don't fetch if challengeId is invalid (0, null, undefined)
    if (!challengeId) {
      setData({ challenge: null, progress: null });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [challengeData, progressData] = await Promise.all([
        fetchWithAuth<{ challenge: Challenge; participation: ChallengeProgress | null }>(
          `/rewards/challenges/${challengeId}`
        ),
        fetchWithAuth<ChallengeProgress>(`/rewards/challenges/${challengeId}/progress`).catch(() => null),
      ]);

      setData({
        challenge: challengeData.challenge,
        progress: progressData,
      });
    } catch (err) {
      console.error('Error fetching challenge:', err);
      setData({ challenge: null, progress: null });
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  return { data, isLoading, refetch: fetchChallenge };
}

/**
 * Hook para el catálogo
 */
export function useCatalog(category?: string) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [userPoints, setUserPoints] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = category ? `?category=${category}` : '';
      const result = await fetchWithAuth<{
        items: CatalogItem[];
        user_points: number;
        user_level: number;
      }>(`/rewards/catalog${params}`);

      setItems(result.items);
      setUserPoints(result.user_points);
      setUserLevel(result.user_level);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const redeemItem = useCallback(async (
    itemId: number, 
    deliveryInfo?: Record<string, unknown>,
    notes?: string
  ) => {
    try {
      const result = await fetchWithAuth<{
        redemption_id: number;
        status: string;
        points_spent: number;
        new_balance: number;
      }>(`/rewards/catalog/${itemId}/redeem`, {
        method: 'POST',
        body: JSON.stringify({ delivery_info: deliveryInfo, notes }),
      });

      await fetchCatalog();
      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error al canjear item',
      };
    }
  }, [fetchCatalog]);

  return { items, userPoints, userLevel, isLoading, error, refetch: fetchCatalog, redeemItem };
}

/**
 * Hook para redenciones
 */
export function useRedemptions(status?: string) {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRedemptions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = status ? `?status=${status}` : '';
      const result = await fetchWithAuth<Redemption[]>(`/rewards/redemptions${params}`);
      setRedemptions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  return { redemptions, isLoading, error, refetch: fetchRedemptions };
}

// Tipos para Analytics
export interface AnalyticsOverview {
  total_users: number;
  active_users: number;
  total_points_distributed: number;
  total_badges_awarded: number;
  total_challenges_completed: number;
  total_redemptions: number;
}

export interface AnalyticsTrends {
  users_change: number;
  points_change: number;
  badges_change: number;
  challenges_change: number;
}

export interface TopAction {
  action: string;
  label: string;
  count: number;
  points: number;
}

export interface BadgeDistribution {
  rarity: string;
  count: number;
  percentage: number;
}

export interface ChallengeStats {
  active: number;
  completed: number;
  participation_rate: number;
  avg_completion_time: number;
}

export interface RedemptionByCategory {
  category: string;
  count: number;
  value: number;
}

export interface WeeklyActivity {
  day: string;
  date: string;
  points: number;
  badges: number;
  challenges: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  trends: AnalyticsTrends;
  top_actions: TopAction[];
  badge_distribution: BadgeDistribution[];
  challenge_stats: ChallengeStats;
  redemptions_by_category: RedemptionByCategory[];
  weekly_activity: WeeklyActivity[];
  period: string;
}

/**
 * Hook para analytics de gamificación
 */
export function useRewardsAnalytics(period: string = 'month') {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchWithAuth<AnalyticsData>(`/rewards/analytics?period=${period}`);
      setData(result);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, isLoading, error, refetch: fetchAnalytics };
}
