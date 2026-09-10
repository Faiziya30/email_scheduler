import { apiClient, API_BASE_URL } from './client';
import type { ApiSuccess, User } from '../types';

export interface DevTokenResponse extends ApiSuccess<User> {
  token: string;
  user: User;
}

export const authApi = {
  /**
   * Fetch current authenticated user's profile
   */
  getMe: async (): Promise<User> => {
    const res = await apiClient<ApiSuccess<User>>('/auth/me');
    return res.data;
  },

  /**
   * Terminate current session and clear auth cookie
   */
  logout: async (): Promise<void> => {
    await apiClient<ApiSuccess<null>>('/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Dev helper login for testing without Google credentials
   */
  devToken: async (): Promise<User> => {
    const res = await apiClient<DevTokenResponse>('/auth/dev-token', {
      method: 'POST',
    });
    return res.user || res.data;
  },

  /**
   * Full page redirect URL for Google OAuth consent screen
   */
  getGoogleAuthUrl: (): string => {
    return `${API_BASE_URL}/auth/google`;
  },
};

export const { getMe, logout, devToken, getGoogleAuthUrl } = authApi;
