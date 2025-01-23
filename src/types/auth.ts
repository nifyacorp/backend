export interface User {
  id: string;
  email: string;
  name?: string;
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

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

export interface GoogleAuthResponse {
  url: string;
  state: string;
}

export interface GoogleCallbackParams {
  code: string;
  state: string;
}