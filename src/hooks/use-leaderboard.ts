'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import type { LeaderboardEntry } from '@/types/rewards';

export type LeaderboardMetric = 'points' | 'experience' | 'streak' | 'level' | 'lifetime_points';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardData {
  metric: string;
  period: string;
  entries: LeaderboardEntry[];
  generatedAt: string;
}

export interface UserPosition {
  position: number;
  value: number;
  totalParticipants: number;
  percentile: number;
}

export interface NearbyUsers {
  userPosition: number;
  entries: LeaderboardEntry[];
}

interface UseLeaderboardOptions {
  metric?: LeaderboardMetric;
  period?: LeaderboardPeriod;
  limit?: number;
  autoFetch?: boolean;
}

export function useLeaderboard(options: UseLeaderboardOptions = {}) {
  const {
    metric: initialMetric = 'points',
    period: initialPeriod = 'monthly',
    limit = 50,
    autoFetch = true,
  } = options;

  const [ranking, setRanking] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [metric, setMetric] = useState<LeaderboardMetric>(initialMetric);
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);

  const fetchRanking = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/api/rewards/leaderboard', { params: { metric, period, limit } });
      setRanking(res.data.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [metric, period, limit]);

  useEffect(() => {
    if (autoFetch) fetchRanking();
  }, [fetchRanking, autoFetch]);

  return { ranking, isLoading, error, metric, period, setMetric, setPeriod, refetch: fetchRanking };
}

export function useMyLeaderboardPosition(
  metric: LeaderboardMetric = 'points',
  period: LeaderboardPeriod = 'monthly'
) {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUsers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPosition = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/api/rewards/leaderboard/position', { params: { metric, period } });
      setPosition(res.data.data.position);
      setNearbyUsers(res.data.data.nearby_users);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [metric, period]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return { position, nearbyUsers, isLoading, error, refetch: fetchPosition };
}

export function useLeaderboardStats() {
  const [stats, setStats] = useState<Record<string, Record<string, UserPosition | null>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/api/rewards/leaderboard/stats');
      setStats(res.data.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}

export function useMultipleLeaderboards(
  configs: { metric: LeaderboardMetric; period: LeaderboardPeriod }[]
) {
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardData>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const promises = configs.map(async ({ metric, period }) => {
        const res = await api.get('/api/rewards/leaderboard', { params: { metric, period, limit: 10 } });
        return { key: `${metric}_${period}`, data: res.data.data };
      });
      const results = await Promise.all(promises);
      const newLeaderboards: Record<string, LeaderboardData> = {};
      results.forEach(({ key, data }) => { newLeaderboards[key] = data; });
      setLeaderboards(newLeaderboards);
    } catch (err) {
      console.error('Error fetching leaderboards:', err);
    } finally {
      setIsLoading(false);
    }
  }, [configs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { leaderboards, isLoading, refetch: fetchAll };
}
