import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { ACTIVITY_LEVELS, GENDERS } from '../lib/constants';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({
    name: '', gender: '', birthDate: '', heightCm: '',
    activityLevel: 'MODERATE',
  });
  const [targets, setTargets] = useState({
    dailyCalorieTarget: '', dailyWaterTargetMl: '',
  });
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        gender: user.gender || '',
        birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
        heightCm: user.heightCm?.toString() || '',
        activityLevel: user.activityLevel || 'MODERATE',
      });
      setTargets({
        dailyCalorieTarget: user.dailyCalorieTarget?.toString() || '',
        dailyWaterTargetMl: user.dailyWaterTargetMl?.toString() || '',
      });
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving('profile');
    setMsg('');
    try {
      const data: any = { name: profile.name, activityLevel: profile.activityLevel };
      if (profile.gender) data.gender = profile.gender;
      if (profile.birthDate) data.birthDate = new Date(profile.birthDate).toISOString();
      if (profile.heightCm) data.heightCm = Number(profile.heightCm);
      await api.put('/users/profile', data);
      await refreshUser();
      setMsg('個人資料已更新');
    } catch { setMsg('儲存失敗'); }
    finally { setSaving(''); }
  };

  const saveTargets = async () => {
    setSaving('targets');
    setMsg('');
    try {
      const data: any = {};
      if (targets.dailyCalorieTarget) data.dailyCalorieTarget = Number(targets.dailyCalorieTarget);
      if (targets.dailyWaterTargetMl) data.dailyWaterTargetMl = Number(targets.dailyWaterTargetMl);
      await api.put('/users/preferences', data);
      await refreshUser();
      setMsg('目標已更新');
    } catch { setMsg('儲存失敗'); }
    finally { setSaving(''); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-2xl font-bold">設定</h1>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      {/* Profile Section */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-heading font-semibold text-lg mb-4">個人資料</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">姓名</label>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">性別</label>
            <select value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm cursor-pointer">
              <option value="">未設定</option>
              {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">出生日期</label>
            <input type="date" value={profile.birthDate} onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">身高 (cm)</label>
            <input type="number" value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="170" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-muted mb-1">活動量</label>
            <select value={profile.activityLevel} onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm cursor-pointer">
              {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving === 'profile'}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer">
          {saving === 'profile' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          儲存個人資料
        </button>
      </section>

      {/* Targets Section */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-heading font-semibold text-lg mb-4">每日目標</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">每日熱量目標 (kcal)</label>
            <input type="number" value={targets.dailyCalorieTarget} onChange={(e) => setTargets({ ...targets, dailyCalorieTarget: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="2000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">每日飲水目標 (ml)</label>
            <input type="number" value={targets.dailyWaterTargetMl} onChange={(e) => setTargets({ ...targets, dailyWaterTargetMl: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="2000" />
          </div>
        </div>
        <button onClick={saveTargets} disabled={saving === 'targets'}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer">
          {saving === 'targets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          儲存目標
        </button>
      </section>
    </div>
  );
}
