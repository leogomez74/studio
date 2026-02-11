"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { API_BASE_URL } from "@/lib/env";
import { clearStoredAuth, getAuthToken, getAuthUser, updateStoredUser } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthGuard");
  }
  return context;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const redirectToLogin = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
    // Hard reload para garantizar que se limpie todo el estado
    if (typeof window !== 'undefined') {
      window.location.href = "/?auth=required";
    }
  }, []);

  const fetchUser = useCallback(
    async (currentToken: string) => {
      try {
        const response = await fetch(`${API_BASE_URL}/me`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const payload: { user: AuthUser } = await response.json();
        setUser(payload.user);
        updateStoredUser(payload.user);
      } catch (error) {
        console.error("No se pudo recuperar el usuario actual", error);
        redirectToLogin();
      }
    },
    [redirectToLogin]
  );

  const refreshUser = useCallback(async () => {
    if (!token) {
      redirectToLogin();
      return;
    }

    await fetchUser(token);
  }, [fetchUser, redirectToLogin, token]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
      } catch (error) {
        console.warn("Error al cerrar sesión en el backend", error);
      }
    }

    redirectToLogin();
  }, [redirectToLogin, token]);

  useEffect(() => {
    const storedToken = getAuthToken();
    const storedUser = getAuthUser();

    if (!storedToken) {
      redirectToLogin();
      setIsChecking(false);
      return;
    }

    setToken(storedToken);
    if (storedUser) {
      setUser(storedUser);
    }

    fetchUser(storedToken).finally(() => setIsChecking(false));
  }, [fetchUser, redirectToLogin]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      refreshUser,
      logout,
    }),
    [logout, refreshUser, token, user]
  );

  if (isChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Verificando sesión…</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
