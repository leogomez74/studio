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
  evolution_instance?: {
    id: number;
    instance_name: string;
    alias: string;
    phone_number: string;
    status: string;
  } | null;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}
