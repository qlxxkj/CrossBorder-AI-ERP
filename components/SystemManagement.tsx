
import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Building, Plus, Trash2, Mail, Edit3, Loader2, 
  Check, X, Save, ShieldCheck, MapPin, UserCheck, Phone, 
  Settings, Key, RefreshCw, Power
} from 'lucide-react';
import { UILanguage, Organization, UserProfile, Role, RolePermission } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

interface SystemManagementProps {
  uiLang: UILanguage;
  orgId: string;
  orgData: Organization | null;
  onOrgUpdate: (org: Organization) => void;
  activeSubTab?: 'users' | 'roles' | 'org';
  onSubTabChange?: (tab: 'users' | 'roles' | 'org') => void;
}

const MENU_OPTIONS = [
  { id: 'dashboard', label: 'dashboard', desc: 'Overview statistics' },
  { id: 'listings', label: 'listings', desc: 'Product inventory management' },
  { id: 'categories', label: 'categoryMgmt', desc: 'Product taxonomy' },
  { id: 'pricing', label: 'pricing', desc: 'Price adjustments & rates' },
  { id: 'templates', label: 'templateManager', desc: 'Excel export mapping' },
  { id: 'system:org', label: 'orgMgmt', desc: 'Organization details' },
  { id: 'system:roles', label: 'roleMgmt', desc: 'RBAC permissions' },
  { id: 'system:users', label: 'userMgmt', desc: 'Member management' },
];

export const SystemManagement: React.FC<SystemManagementProps> = ({ uiLang, orgId, orgData, onOrgUpdate, activeSubTab = 'users', onSubTabChange }) => {
  const t = useTranslation(uiLang);
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
    if (activeSubTab === 'users') fetchMembers();
    if (activeSubTab === 'roles') fetchRoles();
  }, [activeSubTab, orgId]);

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
      alert(t('saveSuccess'));
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

  const handleToggleStatus = async (user: UserProfile) => {
    setLoading(true);
    const newStatus = !user.is_suspended;
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_suspended: newStatus })
      .eq('id', user.id);
    
    if (!error) {
      setMembers(members.map(m => m.id === user.id ? { ...m, is_suspended: newStatus } : m));
    }
    setLoading(false);
  };

  const handleResetPassword = async (userId: string) => {
    if (!window.confirm(t('resetWarning'))) return;
    setLoading(true);
    setTimeout(() => {
      alert(uiLang === 'zh' ? "密码已重置为 000000（模拟成功）。" : "Password reset to 000000 (Simulated).");
      setLoading(false);
    }, 800);
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
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl">
            <Settings size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('systemMgmt')}</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Global Access Control</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <TabButton active={activeSubTab === 'users'} onClick={() => onSubTabChange?.('users')} icon={<Users size={16}/>} label={t('userMgmt')} />
          <TabButton active={activeSubTab === 'roles'} onClick={() => onSubTabChange?.('roles')} icon={<Shield size={16}/>} label={t('roleMgmt')} />
          <TabButton active={activeSubTab === 'org'} onClick={() => onSubTabChange?.('org')} icon={<Building size={16}/>} label={t('orgMgmt')} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px] flex flex-col relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
             <Loader2 size={40} className="animate-spin text-indigo-600" />
          </div>
        )}

        {activeSubTab === 'users' && (
          <div className="p-10 space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                 <Users className="text-indigo-600" size={18} /> {t('userMgmt')}
               </h3>
               <button onClick={() => { setEditingMember(null); setShowMemberModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                 <Plus size={14}/> {t('addMember')}
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <th className="pb-4 px-4">{t('email')}</th>
                       <th className="pb-4 px-4">{t('roleMgmt')}</th>
                       <th className="pb-4 px-4">{t('status')}</th>
                       <th className="pb-4 px-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {members.map(m => (
                      <tr key={m.id} className={`group hover:bg-slate-50/50 transition-all ${m.is_suspended ? 'opacity-60 grayscale' : ''}`}>
                        <td className="py-6 px-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                               <Mail size={16} />
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-800">{m.email || 'N/A'}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{m.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-4">
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${m.role === 'tenant_admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                             {m.role}
                           </span>
                        </td>
                        <td className="py-6 px-4">
                           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${m.is_suspended ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${m.is_suspended ? 'bg-red-500' : 'bg-green-500'}`}></div>
                             {m.is_suspended ? t('disabled') : t('enabled')}
                           </span>
                        </td>
                        <td className="py-6 px-4 text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleResetPassword(m.id)}
                                title={t('resetPassword')} 
                                className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl"
                              >
                                <RefreshCw size={16}/>
                              </button>
                              <button 
                                onClick={() => handleToggleStatus(m)}
                                title={m.is_suspended ? t('activate') : t('suspend')}
                                className={`p-2.5 rounded-xl ${m.is_suspended ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                              >
                                <Power size={16}/>
                              </button>
                              <button onClick={() => { setEditingMember(m); setShowMemberModal(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Edit3 size={16}/></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeSubTab === 'roles' && (
          <div className="p-10 space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                 <Shield className="text-indigo-600" size={18} /> {t('roleMgmt')}
               </h3>
               <button onClick={() => { setEditingRole({ id: '', org_id: orgId, name: '', permissions: [], created_at: '' }); setShowRoleModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                 <Plus size={14}/> {t('addMember')}
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
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{role.description || 'Enterprise RBAC'}</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeSubTab === 'org' && (
          <div className="p-10 space-y-12">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                 <Building className="text-indigo-600" size={18} /> {t('orgMgmt')}
               </h3>
               <button onClick={handleSaveOrg} className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                 <Save size={16}/> {t('save')}
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                  <OrgField label={t('orgName')} icon={<Building size={14}/>}>
                    <input value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} className="org-input" />
                  </OrgField>
                  <OrgField label={t('orgAddress')} icon={<MapPin size={14}/>}>
                    <textarea value={orgForm.address} onChange={e => setOrgForm({...orgForm, address: e.target.value})} className="org-input min-h-[100px]" />
                  </OrgField>
               </div>
               <div className="space-y-6">
                  <OrgField label={t('contactName')} icon={<UserCheck size={14}/>}>
                    <input value={orgForm.contact_name} onChange={e => setOrgForm({...orgForm, contact_name: e.target.value})} className="org-input" />
                  </OrgField>
                  <OrgField label={t('contactPhone')} icon={<Phone size={14}/>}>
                    <input value={orgForm.contact_phone} onChange={e => setOrgForm({...orgForm, contact_phone: e.target.value})} className="org-input" />
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
                 <h3 className="font-black text-slate-900 uppercase tracking-tight">{t('userMgmt')}</h3>
                 <button onClick={() => setShowMemberModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveMember} className="p-8 space-y-6">
                 {!editingMember && (
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('emailAddr')}</label>
                     <input type="email" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="name@company.com" />
                   </div>
                 )}
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('roleMgmt')}</label>
                   <select 
                    value={editingMember?.role || 'user'} 
                    onChange={e => setEditingMember(prev => prev ? {...prev, role: e.target.value as any} : null)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase"
                   >
                     <option value="user">User</option>
                     <option value="admin">Admin</option>
                     <option value="tenant_admin">Owner</option>
                   </select>
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{t('save')}</button>
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
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('roleMgmt')}</h3>
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1 italic">Fine-grained RBAC Matrix</p>
                 </div>
                 <button onClick={() => setShowRoleModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={28}/></button>
              </div>
              <div className="p-10 flex-1 overflow-y-auto custom-scrollbar space-y-10">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                       <input value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                       <input value={editingRole.description} onChange={e => setEditingRole({...editingRole, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Key size={14}/> Matrix Control</h4>
                    <div className="border border-slate-100 rounded-[2rem] overflow-hidden">
                       <table className="w-full">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             <tr>
                                <th className="p-6 text-left">Menu Module</th>
                                <th className="p-6 text-center">R</th>
                                <th className="p-6 text-center">C</th>
                                <th className="p-6 text-center">U</th>
                                <th className="p-6 text-center">D</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-sm">
                             {MENU_OPTIONS.map(menu => {
                               const perm = (editingRole.permissions || []).find(p => p.menu_id === menu.id) || { can_read: false, can_create: false, can_update: false, can_delete: false };
                               return (
                                 <tr key={menu.id} className="hover:bg-slate-50/50">
                                    <td className="p-6 font-bold text-slate-700">
                                      {t(menu.label)}
                                      <p className="text-[8px] text-slate-400 uppercase tracking-tighter mt-0.5">{menu.desc}</p>
                                    </td>
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
                 <button onClick={() => setShowRoleModal(false)} className="px-10 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                 <button onClick={handleSaveRole} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2"><Save size={18}/> {t('save')}</button>
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
