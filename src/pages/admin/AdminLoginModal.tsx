import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../services/storage';
import { AdminUser } from '../../types/property';
import { X, Lock, Shield, User, KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
  authNotice?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  authNotice,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid administrator email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password: password.trim(),
        }),
      });

      const data = await resp.json().catch(() => null);
      setLoading(false);

      if (!resp.ok || !data?.token || !data?.user) {
        setError(data?.error || 'Authentication rejected. Verify your administrator credentials.');
        return;
      }

      const authenticatedUser: AdminUser = {
        id: String(data.user.adminId || data.user.id || 'admin-01'),
        email: String(data.user.email || 'info@buildsmoremohali.com'),
        name: String(data.user.name || 'Executive Managing Director'),
        role: (data.user.role === 'Editor' ? 'Editor' : 'SuperAdmin') as AdminUser['role'],
        lastLoginAt: new Date().toISOString(),
      };

      storage.setAuthenticatedAdmin(authenticatedUser, data.token);
      onLoginSuccess(authenticatedUser);
      onClose();
    } catch {
      setLoading(false);
      setError('Unable to reach authentication server. Please verify the backend service is running.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#101419] border border-[#2c3645] text-[#f7f5f2] rounded-sm shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close login dialog"
          className="absolute top-4 right-4 text-[#8a909a] hover:text-[#f7f5f2] transition-colors cursor-pointer p-1 rounded-sm hover:bg-[#1a212b]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <img
              src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
              alt="BUILDsmore Logo"
              className="w-16 h-16 rounded-sm object-cover border border-[#c5a059]/50 mx-auto shadow-md"
            />
            <div className="absolute -bottom-1 -right-1 bg-[#101419] border border-[#c5a059] p-0.5 rounded-full">
              <Shield className="w-3.5 h-3.5 text-[#c5a059]" />
            </div>
          </div>

          <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[#c5a059] block pt-1">
            BUILDsmore · Administrative Gateway
          </span>
          <h2 className="font-serif text-2xl font-normal text-white">
            Admin Authentication
          </h2>
          <p className="text-xs text-[#8a909a] max-w-xs mx-auto">
            Sign in with verified administrator credentials to manage properties, inquiries, and settings.
          </p>
        </div>

        {/* Session Notice Feedback */}
        {!error && authNotice && (
          <div className="p-3 bg-amber-950/50 border border-amber-700/80 rounded-sm text-xs text-amber-200 flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{authNotice}</span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-sm text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs (Starts Empty for User to Fill) */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono text-[#a0a8b4] uppercase block mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@buildsmoremohali.com"
                className="w-full bg-[#161b22] border border-[#2a3442] focus:border-[#c5a059] rounded-sm pl-9 pr-3 py-2.5 text-xs text-[#f7f5f2] placeholder-[#555f6d] focus:outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono text-[#a0a8b4] uppercase block">
                Password
              </label>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-[#161b22] border border-[#2a3442] focus:border-[#c5a059] rounded-sm pl-9 pr-10 py-2.5 text-xs text-[#f7f5f2] placeholder-[#555f6d] focus:outline-none font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a909a] hover:text-[#f7f5f2] transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-widest font-semibold rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 mt-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{loading ? 'Authenticating Session...' : 'Sign In as Administrator'}</span>
          </button>
        </form>

        {/* Secure Session Notice */}
        <div className="pt-3 border-t border-[#1f2732]">
          <div className="flex items-start gap-2 text-[11px] text-[#8a909a] leading-relaxed bg-[#141a22] p-2.5 border border-[#222b37] rounded-sm">
            <ShieldCheck className="w-4 h-4 text-[#c5a059] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#f7f5f2] block">Browser-Bound Secure Session</strong>
              Your session expires immediately whenever you close the browser window or tab.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
