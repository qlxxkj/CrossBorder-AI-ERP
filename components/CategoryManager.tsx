
import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, Save, X, Tags, Loader2, Search, 
  Calendar, Clock, AlertCircle, Check, ChevronRight 
} from 'lucide-react';
import { Category, UILanguage } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

interface CategoryManagerProps {
  uiLang: UILanguage;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired");

      const { data, error } = await supabase
        .from('categories')
        .insert([{ 
          name: newCategoryName.trim(), 
          user_id: session.user.id 
        }])
        .select();
      
      if (error) throw error;
      if (data) {
        setCategories([data[0], ...categories]);
        setNewCategoryName('');
        setIsAdding(false);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(uiLang === 'zh' ? `确定要删除分类 "${name}" 吗？` : `Delete category "${name}"?`)) return;
    
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) {
      setCategories(categories.filter(c => c.id !== id));
    } else {
      alert(error.message);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const saveEdit = async () => {
    if (!editingName.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({ 
          name: editingName.trim(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', editingId);
        
      if (error) throw error;

      setCategories(categories.map(c => 
        c.id === editingId 
          ? { ...c, name: editingName.trim(), updated_at: new Date().toISOString() } 
          : c
      ));
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return uiLang === 'zh' 
      ? date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-slate-200">
            <Tags size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {t('categoryMgmt')}
            </h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
              {categories.length} {t('activeCat')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text"
              placeholder={t('searchCat')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${
              isAdding 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
            }`}
          >
            {isAdding ? <X size={18} /> : <Plus size={18} />}
            {isAdding ? t('back') : t('addNew')}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-500/20 shadow-2xl shadow-indigo-500/5 animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Tags className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300" size={20} />
              <input 
                type="text" 
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={uiLang === 'zh' ? "输入新分类名称 (例如：3C数码、家居用品...)" : "Enter category name..."}
                className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl font-bold text-lg outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300"
              />
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting || !newCategoryName.trim()}
              className="px-10 py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-indigo-200"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {t('createCat')}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                <th className="p-8">{t('catName')}</th>
                <th className="p-8">{t('createdDate')}</th>
                <th className="p-8">{t('lastModified')}</th>
                <th className="p-8 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <Loader2 className="animate-spin" size={40} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Fetching Taxonomy...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-200">
                      <Tags size={64} />
                      <p className="text-xl font-black uppercase tracking-tighter">No Categories Found</p>
                      <button onClick={() => setIsAdding(true)} className="text-indigo-500 font-bold hover:underline">Create your first one</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map(cat => (
                  <tr key={cat.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="p-8">
                      {editingId === cat.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            value={editingName} 
                            onChange={(e) => setEditingName(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="bg-white border-2 border-indigo-500 px-4 py-2 rounded-xl text-sm font-bold outline-none shadow-lg shadow-indigo-500/10 w-full max-w-xs" 
                            autoFocus 
                          />
                          <button onClick={saveEdit} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"><Save size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-all"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <Tags size={18} />
                          </div>
                          <span className="font-black text-slate-700">{cat.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        <Calendar size={14} className="text-slate-200" />
                        {formatDate(cat.created_at)}
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-tight bg-indigo-50/50 w-fit px-3 py-1.5 rounded-full border border-indigo-100/50">
                        <Clock size={14} />
                        {formatDate(cat.updated_at || cat.created_at)}
                      </div>
                    </td>
                    <td className="p-8 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => startEdit(cat)} 
                          className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id, cat.name)} 
                          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                        <div className="p-3 text-slate-200">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
