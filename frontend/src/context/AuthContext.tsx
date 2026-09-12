import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '../types';
import { getMe, logout as apiLogout, devToken as apiDevToken, authApi } from '../api/auth';
import { ApiError } from '../api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  devLogin: () => Promise<void>;
  emailLogin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<any>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  // Intercept Google OAuth redirect URL query parameter (?token=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('auth_token', tokenFromUrl);
      // Clean up the URL parameter cleanly
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    }
  }, [queryClient]);

  // Query /auth/me on mount with React Query
  const {
    data: user,
    isLoading,
    refetch: refetchUser,
  } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await getMe();
      } catch (err: any) {
        // 401 unauthenticated is expected when not logged in
        if (err instanceof ApiError && err.statusCode === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const login = useCallback(() => {
    // Full page redirect to Google OAuth
    window.location.href = authApi.getGoogleAuthUrl();
  }, []);

  const devLogin = useCallback(async () => {
    const loggedInUser = await apiDevToken();
    queryClient.setQueryData(['auth', 'me'], loggedInUser);
  }, [queryClient]);

  const emailLogin = useCallback(async (email: string, password: string) => {
    const res = await authApi.emailLogin(email, password);
    if (res.token) {
      localStorage.setItem('auth_token', res.token);
    }
    queryClient.setQueryData(['auth', 'me'], res.user);
  }, [queryClient]);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const res = await authApi.signup(email, password, name);
    if (res.token) {
      localStorage.setItem('auth_token', res.token);
    }
    queryClient.setQueryData(['auth', 'me'], res.user);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore network failure on logout
    } finally {
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      queryClient.clear();
      window.location.replace('/login');
    }
  }, [queryClient]);


  const isAuthenticated = Boolean(user && user.id);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated,
        login,
        devLogin,
        emailLogin,
        signup,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
};

