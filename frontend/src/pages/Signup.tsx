import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context';
import { Spinner } from '../components/Loader';

export const Signup: React.FC = () => {
  const { user, isLoading, isAuthenticated, login, signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already authenticated, redirect straight to dashboard
  if (isAuthenticated || user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email and password are required.');
      setFormLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      setFormLoading(false);
      return;
    }

    try {
      await signup(email.trim(), password, name.trim() || undefined);
    } catch (err: any) {
      const msg = err?.message || 'Signup failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setFormLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="xl" color="border-[#00A854]" />
          <p className="text-xs text-gray-500 font-medium">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
      {/* Centered Signup Card — same aesthetic as Login */}
      <div className="w-full max-w-[400px] rounded-2xl border border-gray-200/80 p-8 sm:p-10 shadow-[0_4px_25px_rgba(0,0,0,0.03)] bg-white">
        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-gray-900 tracking-tight mb-7">
          Create Account
        </h1>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        {/* 1. Google OAuth Button matching Figma's mint background */}
        <button
          id="google-signup-button"
          type="button"
          onClick={login}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-[#E8F5E9] hover:bg-[#DCFCE7] active:scale-[0.99] text-sm font-medium text-gray-800 transition-all shadow-none border border-[#C8E6C9]"
        >
          {/* Official Google 'G' icon */}
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign up with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-150" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-gray-400 font-normal">
              or sign up with email
            </span>
          </div>
        </div>

        {/* Name, Email & Password Form */}
        <form onSubmit={handleSignup} className="space-y-3.5">
          <div>
            <input
              id="signup-name-input"
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-[#F3F4F6] border-0 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A854]/40 transition"
            />
          </div>

          <div>
            <input
              id="signup-email-input"
              type="email"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl bg-[#F3F4F6] border-0 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A854]/40 transition"
            />
          </div>

          <div>
            <input
              id="signup-password-input"
              type="password"
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl bg-[#F3F4F6] border-0 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A854]/40 transition"
            />
          </div>

          {/* Solid Green Signup Button */}
          <button
            id="submit-signup-btn"
            type="submit"
            disabled={formLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#00A854] hover:bg-[#009249] active:scale-[0.99] text-white font-medium text-sm transition-all shadow-none flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-70"
          >
            {formLoading ? <Spinner size="sm" color="border-white" /> : 'Create Account'}
          </button>
        </form>

        {/* Link to Login */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-[#00A854] hover:text-[#009249] font-medium transition-colors"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
};

export default Signup;
