
import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Building, Plus, Trash2, Mail, Edit3, Loader2, 
  Check, X, Save, ShieldCheck, MapPin, UserCheck, Phone, 
  LayoutDashboard, List, Tags, Coins, Layout, Settings, Key,
  Lock, AlertCircle
} from 'lucide-react';
import { UILanguage, Organization, UserProfile, Role, RolePermission } from '../types';
import { supabase } from '../lib/supabaseClient';

interface SystemManagementProps {
  uiLang: UILanguage;
  orgId: string;
  orgData: Organization | null;
  onOrgUpdate: (org: Organization) => void;
}

const MENU_OPTIONS = [
  { id: 'dashboard', label: '仪表盘/概览' },
  { id: 'listings', label: '产品管理' },
  { id: 'categories', label: '类目管理' },
  { id: 'pricing', label: '定价中心' },
  { id: 'templates', label: '模板管理' },
  { id: 'system', label: '系统管理' }
];

export const SystemManagement: React.FC<SystemManagementProps> = ({ uiLang, orgId, orgData, onOrgUpdate }) => {
  const [activeTab, setActiveTab] = useState<'org' | 'roles' | 'users'>('users');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);

  const [orgForm, setOrgForm] = useState({
    name: orgData?.name || '',
    address: orgData?.address || '',
    contact_name: orgData?.contact_name || '',
    contact_phone: orgData?.contact_phone || ''
  });

  useEffect(() => {
    if (activeTab === 'users') fetchMembers();
    if (activeTab === 'roles') fetchRoles();
  }, [activeTab, orgId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').eq('org_id', orgId);
    setMembers(data || []);
    setLoading(false);
  };

  const fetchRoles = async () => {
    setLoading(true);
    const { data } = await supabase.from('roles').select('*').eq('org_id', orgId);
    setRoles(data || []);
    setLoading(false);
  };

  const handleSaveOrg = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('organizations')
      .update(orgForm)
      .eq('id', orgId);
    if (!error) {
      onOrgUpdate({ ...orgData!, ...orgForm });
      alert("组织信息已保存。");
    }
    setLoading(false);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      setLoading(true);
      await supabase.from('user_profiles').update({ role: editingMember.role }).eq('id', editingMember.id);
      fetchMembers();
      setShowMemberModal(false);
      setLoading(false);
    }
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    setLoading(true);
    if (editingRole.id) {
      await supabase.from('roles').update(editingRole).eq('id', editingRole.id);
    } else {
      await supabase.from('roles').insert([{ ...editingRole, id: crypto.randomUUID(), org_id: orgId }]);
    }
    fetchRoles();
    setShowRoleModal(false);
    setLoading(false);
  };

  const updateRolePermission = (menuId: string, action: keyof RolePermission, value: boolean) => {
    if (!editingRole) return;
    const newPerms = [...(editingRole.permissions || [])];
    let perm = newPerms.find(p => p.menu_id === menuId);
    if (!perm) {
      perm = { menu_id: menuId, can_create: false, can_read: true, can_update: false, can_delete: false };
      newPerms.push(perm);
    }
    (perm as any)[action] = value;
    setEditingRole({ ...editingRole, permissions: newPerms });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in pb-24">
      {/* 头部标题与切换 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl">
            <Settings size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">企业配置</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Resource & Access Control</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={16}/>} label="成员管理" />
          <TabButton active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} icon={<Shield size={16}/>} label="角色矩阵" />
          <TabButton active={activeTab === 'org'} onClick={() => setActiveTab('org')} icon={<Building size={16}/>} label="组织机构" />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px] flex flex-col relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
             <Loader2 size={40} className="animate-spin text-indigo-600" />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-10 space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                 <Users className="text-indigo-600" size={18} /> 租户成员列表
               </h3>
               <button onClick={() => { setEditingMember(null); setShowMemberModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                 <Plus size={14}/> 邀请成员
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <th className="pb-4 px-4">登录邮箱 / 账号</th>
                       <th className="pb-4 px-4">授权角色</th>
                       <th className="pb-4 px-4">最后在线</th>
                       <th className="pb-4 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {members.map(m => (
                      <tr key={m.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="py-6 px-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                               <Mail size={16} />
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-800">{m.email || '未命名账户'}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{m.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-4">
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${m.role === 'tenant_admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                             {m.role}
                           </span>
                        </td>
                        <td className="py-6 px-4 text-[10px] font-bold text-slate-400">
                           {m.last_login_at ? new Date(m.last_login_at).toLocaleString() : '暂无数据'}
                        </td>
                        <td className="py-6 px-4 text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => { setEditingMember(m); setShowMemberModal(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Edit3 size={16}/></button>
                              <button className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="p-10 space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                 <Shield className="text-indigo-600" size={18} /> 角色权限矩阵
               </h3>
               <button onClick={() => { setEditingRole({ id: '', org_id: orgId, name: '', permissions: [], created_at: '' }); setShowRoleModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                 <Plus size={14}/> 创建新角色
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {roles.map(role => (
                 <div key={role.id} className="p-8 border border-slate-100 rounded-[2.5rem] bg-slate-50/30 group hover:border-indigo-500 transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all"><ShieldCheck size={24}/></div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingRole(role); setShowRoleModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={16}/></button>
                          <button className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                       </div>
                    </div>
                    <h4 className="font-black text-slate-800">{role.name}</h4>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{role.description || '自定义业务权限角色'}</p>
                 </div>
               ))}
               {roles.length === 0 && (
                 <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300 font-black uppercase text-xs tracking-widest">尚未创建自定义角色</div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'org' && (
          <div className="p-10 space-y-12">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                 <Building className="text-indigo-600" size={18} /> 组织资料维护
               </h3>
               <button onClick={handleSaveOrg} className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                 <Save size={16}/> 保存资料
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                  <OrgField label="企业名称" icon={<Building size={14}/>}>
                    <input value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} className="org-input" placeholder="输入全称..." />
                  </OrgField>
                  <OrgField label="公司地址" icon={<MapPin size={14}/>}>
                    <textarea value={orgForm.address} onChange={e => setOrgForm({...orgForm, address: e.target.value})} className="org-input min-h-[100px]" placeholder="详细地址..." />
                  </OrgField>
               </div>
               <div className="space-y-6">
                  <OrgField label="业务联系人" icon={<UserCheck size={14}/>}>
                    <input value={orgForm.contact_name} onChange={e => setOrgForm({...orgForm, contact_name: e.target.value})} className="org-input" placeholder="姓名" />
                  </OrgField>
                  <OrgField label="联系电话" icon={<Phone size={14}/>}>
                    <input value={orgForm.contact_phone} onChange={e => setOrgForm({...orgForm, contact_phone: e.target.value})} className="org-input" placeholder="手机或固话" />
                  </OrgField>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* 用户编辑弹窗 */}
      {showMemberModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="font-black text-slate-900 uppercase tracking-tight">配置成员身份</h3>
                 <button onClick={() => setShowMemberModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveMember} className="p-8 space-y-6">
                 {!editingMember && (
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">邮箱地址</label>
                     <input type="email" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="name@company.com" />
                   </div>
                 )}
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">授权角色</label>
                   <select 
                    value={editingMember?.role || 'user'} 
                    onChange={e => setEditingMember(prev => prev ? {...prev, role: e.target.value as any} : null)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase"
                   >
                     <option value="user">普通用户 (User)</option>
                     <option value="admin">部门管理员 (Admin)</option>
                     <option value="tenant_admin">企业所有者 (Owner)</option>
                   </select>
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">保存更改</button>
              </form>
           </div>
        </div>
      )}

      {/* 角色权限矩阵弹窗 */}
      {showRoleModal && editingRole && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                 <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">角色权限配置</h3>
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1 italic">Fine-grained RBAC Matrix</p>
                 </div>
                 <button onClick={() => setShowRoleModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={28}/></button>
              </div>
              <div className="p-10 flex-1 overflow-y-auto custom-scrollbar space-y-10">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">角色名称</label>
                       <input value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">描述信息</label>
                       <input value={editingRole.description} onChange={e => setEditingRole({...editingRole, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Key size={14}/> 菜单与动作控制</h4>
                    <div className="border border-slate-100 rounded-[2rem] overflow-hidden">
                       <table className="w-full">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             <tr>
                                <th className="p-6 text-left">模块菜单</th>
                                <th className="p-6 text-center">查看 (R)</th>
                                <th className="p-6 text-center">新增 (C)</th>
                                <th className="p-6 text-center">编辑 (U)</th>
                                <th className="p-6 text-center">删除 (D)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-sm">
                             {MENU_OPTIONS.map(menu => {
                               const perm = (editingRole.permissions || []).find(p => p.menu_id === menu.id) || { can_read: false, can_create: false, can_update: false, can_delete: false };
                               return (
                                 <tr key={menu.id} className="hover:bg-slate-50/50">
                                    <td className="p-6 font-bold text-slate-700">{menu.label}</td>
                                    <td className="p-6 text-center"><Checkbox checked={perm.can_read} onChange={v => updateRolePermission(menu.id, 'can_read', v)} /></td>
                                    <td className="p-6 text-center"><Checkbox checked={perm.can_create} onChange={v => updateRolePermission(menu.id, 'can_create', v)} /></td>
                                    <td className="p-6 text-center"><Checkbox checked={perm.can_update} onChange={v => updateRolePermission(menu.id, 'can_update', v)} /></td>
                                    <td className="p-6 text-center"><Checkbox checked={perm.can_delete} onChange={v => updateRolePermission(menu.id, 'can_delete', v)} /></td>
                                 </tr>
                               );
                             })}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
              <div className="p-10 border-t border-slate-50 bg-slate-50/30 flex justify-end gap-5">
                 <button onClick={() => setShowRoleModal(false)} className="px-10 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">取消</button>
                 <button onClick={handleSaveRole} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2"><Save size={18}/> 保存角色</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .org-input { width: 100%; padding: 1rem 1.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 1.5rem; font-weight: 700; outline: none; transition: all 0.2s; }
        .org-input:focus { background: white; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.05); }
      `}</style>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon} {label}
  </button>
);

const OrgField = ({ label, icon, children }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">{icon} {label}</label>
    {children}
  </div>
);

const Checkbox = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 hover:border-indigo-400'}`}
  >
    {checked && <Check size={14} strokeWidth={4} />}
  </button>
);
