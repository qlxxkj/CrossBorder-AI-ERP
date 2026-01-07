
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Tags, Loader2, Search } from 'lucide-react';
import { Category, UILanguage } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface CategoryManagerProps {
  uiLang: UILanguage;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ uiLang }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('categories').select('*').order('created_at', { ascending: false });
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newCategoryName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('categories').insert([{ 
      name: newCategoryName.trim(), 
      user_id: session?.user?.id 
    }]).select();
    
    if (error) alert(error.message);
    else {
      setCategories([data[0], ...categories]);
      setNewCategoryName('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(uiLang === 'zh' ? "确定要删除此分类吗？" : "Delete category?")) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) setCategories(categories.filter(c => c.id !== id));
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const saveEdit = async () => {
    if (!editingName.trim()) return;
    const { error } = await supabase.from('categories').update({ name: editingName.trim() }).eq('id', editingId);
    if (!error) {
      setCategories(categories.map(c => c.id === editingId ? { ...c, name: editingName.trim() } : c));
      setEditingId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <Tags size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {uiLang === 'zh' ? '分类管理' : 'Category Management'}
            </h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Custom Product Taxonomy</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex gap-4">
          <input 
            type="text" 
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={uiLang === 'zh' ? "输入新分类名称..." : "New category name..."}
            className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          <button onClick={handleAdd} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={18} /> {uiLang === 'zh' ? '添加分类' : 'Add Category'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 py-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
          ) : categories.length === 0 ? (
            <div className="col-span-2 py-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs italic">No categories created yet.</div>
          ) : categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:border-indigo-100 hover:shadow-lg">
              {editingId === cat.id ? (
                <div className="flex-1 flex gap-2">
                  <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1 bg-white border border-indigo-200 px-3 py-1 rounded-lg text-sm font-bold outline-none" autoFocus />
                  <button onClick={saveEdit} className="text-emerald-500 p-1"><Save size={18} /></button>
                  <button onClick={() => setEditingId(null)} className="text-slate-400 p-1"><X size={18} /></button>
                </div>
              ) : (
                <>
                  <span className="font-black text-slate-700">{cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEdit(cat)} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(cat.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
