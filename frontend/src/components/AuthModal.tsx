import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: any, token: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
      const endpoint = isLogin ? `${apiBase}/api/login` : `${apiBase}/api/register`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.success && data.user && data.token) {
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-none md:shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center mb-8">
          {/* Logo Placeholder */}
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mb-4">
             <span className="text-white font-bold text-xl">S</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isLogin ? '欢迎回来' : '创建账户'}
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            {isLogin ? '让我们继续您的学习之旅。' : '开始您的个性化学习体验。'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-lg">
            {error}
          </div>
        )}

        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mb-6 group">
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          <span className="text-gray-700 font-medium group-hover:text-gray-900">
            {isLogin ? '继续使用 Google' : '使用 Google 注册'}
          </span>
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <span className="relative bg-white px-4 text-xs text-gray-400">
            或继续
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入您的电子邮件"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {isLogin && (
            <div className="flex justify-end">
              <button type="button" className="text-xs text-gray-500 hover:text-gray-900">
                忘记密码?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? '没有账户? ' : '已有账户? '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-gray-900 hover:underline"
          >
            {isLogin ? '注册' : '登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
