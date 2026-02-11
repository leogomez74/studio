export interface AuthUser {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  role?: {
    id: number;
    name: string;
    description?: string;
    full_access: boolean;
  };
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}
