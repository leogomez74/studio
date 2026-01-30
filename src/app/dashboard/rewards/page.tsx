"use client";

import { GamificationDashboard } from "@/components/rewards/gamification-dashboard";
import { ProtectedPage } from "@/components/ProtectedPage";

export default function RewardsDashboardPage() {
  return (
    <ProtectedPage module="recompensas">
      <GamificationDashboard />
    </ProtectedPage>
  );
}
