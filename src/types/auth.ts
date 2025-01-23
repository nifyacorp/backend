export interface User {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthToken {
  token: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  accessToken: AuthToken;
  refreshToken: AuthToken;
}