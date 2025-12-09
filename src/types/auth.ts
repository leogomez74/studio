export interface AuthUser {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}
