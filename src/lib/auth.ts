import { AuthUser } from "@/types/auth";
import Cookies from "js-cookie";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const REMEMBER_EMAIL_KEY = "remembered_email";

export function persistAuth(
  token: string,
  user: AuthUser,
  options: { remember: boolean }
) {
  const { remember } = options;
  
  // Store token in cookie for middleware/server access if needed, 
  // or just localStorage for client-side access.
  // Using cookies is better for security and SSR, but for this simple port:
  
  if (remember) {
    Cookies.set(TOKEN_KEY, token, { expires: 30 }); // 30 days
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    Cookies.set(TOKEN_KEY, token, { expires: 1 }); // 1 day
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getAuthToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const userStr = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function updateStoredUser(user: AuthUser) {
  if (localStorage.getItem(USER_KEY)) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else if (sessionStorage.getItem(USER_KEY)) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearStoredAuth() {
  Cookies.remove(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function logout() {
  clearStoredAuth();
  window.location.href = "/";
}

export function storeRememberedEmail(email: string) {
  localStorage.setItem(REMEMBER_EMAIL_KEY, email);
}

export function getRememberedEmail(): string | null {
  return localStorage.getItem(REMEMBER_EMAIL_KEY);
}

export function clearRememberedEmail() {
  localStorage.removeItem(REMEMBER_EMAIL_KEY);
}
