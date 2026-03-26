import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('兩次密碼不一致'); return; }
    if (password.length < 8) { setError('密碼至少 8 個字元'); return; }
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-surface to-orange-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Heart className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="font-heading text-3xl font-bold text-text">建立帳號</h1>
          <p className="text-text-muted mt-1">開始你的健康管理旅程</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-muted mb-1">姓名</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="你的名字" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-1">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-1">密碼</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="至少 8 個字元" />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-text-muted mb-1">確認密碼</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="再次輸入密碼" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary-dark transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            註冊
          </button>

          <p className="text-center text-sm text-text-muted">
            已有帳號？ <Link to="/login" className="text-primary hover:underline cursor-pointer">立即登入</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
