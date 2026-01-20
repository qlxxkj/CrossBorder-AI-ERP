
import React, { useState, useEffect } from 'react';
import { Users, Shield, Building, Plus, Trash2, Mail, Edit3, Loader2 } from 'lucide-react';
import { UILanguage } from '../types';
import { supabase } from '../lib/supabaseClient';

export const SystemManagement: React.FC<{ uiLang: UILanguage; orgId: string }> = ({ uiLang, orgId }) => {
  const [tab, setTab] = useState<'org' | 'roles' | 'users'>('users');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [orgId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').eq('org_id', orgId);
    setMembers(data || []);
    setLoading(false);
  };

  const tabs = [
    { id: 'org', label: '组织机构', icon: <Building size={16}/> },
    { id: 'roles', label: '角色权限', icon: <Shield size={16}/> },
    { id: 'users', label: '用户管理', icon: <Users size={16}/> },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-900">系统管理</h2>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${tab === t.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px] p-8">
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-700">组织成员 ({members.length})</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"><Plus size={16}/> 添加成员</button>
            </div>
            
            <table className="w-full">
              <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                <tr>
                  <th className="py-4 text-left">用户 ID</th>
                  <th className="py-4 text-left">角色</th>
                  <th className="py-4 text-left">最后活跃</th>
                  <th className="py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Mail size={14}/></div>
                      <span className="text-sm font-bold">{m.id.slice(0, 12)}...</span>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${m.role === 'tenant_admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="py-4 text-xs text-slate-400">{m.last_login_at || 'N/A'}</td>
                    <td className="py-4 text-right">
                      <button className="p-2 text-slate-300 hover:text-indigo-600"><Edit3 size={16}/></button>
                      <button className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {tab === 'org' && <div className="p-10 text-center text-slate-400">组织机构配置正在开发中...</div>}
        {tab === 'roles' && <div className="p-10 text-center text-slate-400">权限系统正在开发中...</div>}
      </div>
    </div>
  );
};
