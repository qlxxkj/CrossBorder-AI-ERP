
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Tags, Loader2, Search, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Category, UILanguage } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface CategoryManagerProps {
  uiLang: UILanguage;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ uiLang }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsAdding(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('categories').insert([{ 
      name: newCategoryName.trim(), 
      user_id: session?.user?.id 
    }]).select();
    
    if (error) {
      alert(error.message);
    } else if (data) {
      setCategories([data[0], ...categories]);
      setNewCategoryName('');
    }
    setIsAdding(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(uiLang === 'zh' ? `确定要删除分类 "${name}" 吗？此操作不可撤销。` : `Delete category "${name}"? This cannot be undone.`)) return;
    
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
    const { error } = await supabase
      .from('categories')
      .update({ name: editingName.trim() })
      .eq('id', editingId);
      
    if (!error) {
      setCategories(categories.map(c => 
        c.id === editingId ? { ...c, name: editingName.trim(), updated_at: new Date().toISOString() } : c
      ));
      setEditingId(null);
    } else {
      alert(error.message);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return uiLang === 'zh' 
      ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : date.toLocaleString();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <Tags size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {uiLang === 'zh' ? '分类管理' : 'Category Management'}
            </h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Organize your global inventory</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text"
            placeholder={uiLang === 'zh' ? "搜索分类..." : "Search categories..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-100 text-white">
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Tags className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={20} />
            <input 
              type="text" 
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={uiLang === 'zh' ? "输入新分类名称 (如：3C数码、户外运动...)" : "Enter new category name..."}
              className="w-full pl-12 pr-6 py-4 bg-white/10 border border-white/20 rounded-2xl font-bold outline-none focus:bg-white/20 placeholder:text-indigo-200 transition-all"
            />
          </div>
          <button 
            type="submit" 
            disabled={isAdding || !newCategoryName.trim()}
            className="px-10 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
          >
            {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {uiLang === 'zh' ? '新增分类' : 'Add Category'}
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Taxonomy...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-32 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-10">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
              <Tags size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">
              {searchTerm ? (uiLang === 'zh' ? '未找到相关分类' : 'No matches found') : (uiLang === 'zh' ? '暂无分类' : 'Empty Taxonomy')}
            </h3>
            <p className="text-sm text-slate-300 font-bold mt-2">
              {uiLang === 'zh' ? '开始创建您的第一个产品类目以提高效率' : 'Start creating your first category to boost efficiency'}
            </p>
          </div>
        ) : (
          filteredCategories.map(cat => (
            <div 
              key={cat.id} 
              className={`flex flex-col md:flex-row items-center justify-between p-6 bg-white border rounded-[2rem] transition-all group ${
                editingId === cat.id ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-slate-100 hover:border-indigo-100 hover:shadow-xl'
              }`}
            >
              <div className="flex items-center gap-5 flex-1 w-full">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  editingId === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                }`}>
                  <Tags size={20} />
                </div>
                
                {editingId === cat.id ? (
                  <div className="flex-1 flex gap-2">
                    <input 
                      value={editingName} 
                      onChange={(e) => setEditingName(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="flex-1 bg-slate-50 border border-indigo-200 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:bg-white" 
                      autoFocus 
                    />
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-black text-slate-700 text-lg">{cat.name}</span>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 uppercase">
                        <Calendar size={10} /> {formatDate(cat.created_at)}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-400 uppercase">
                        <Clock size={10} /> {uiLang === 'zh' ? '更新于' : 'Updated'} {formatDate(cat.updated_at || cat.created_at)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 md:mt-0">
                {editingId === cat.id ? (
                  <>
                    <button 
                      onClick={saveEdit} 
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all"
                    >
                      <Save size={14} /> {uiLang === 'zh' ? '保存' : 'Save'}
                    </button>
                    <button 
                      onClick={() => setEditingId(null)} 
                      className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => startEdit(cat)} 
                      className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title={uiLang === 'zh' ? '编辑' : 'Edit'}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id, cat.name)} 
                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title={uiLang === 'zh' ? '删除' : 'Delete'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tip Card */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 flex items-center gap-6 text-white overflow-hidden relative">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
          <AlertCircle size={24} className="text-indigo-400" />
        </div>
        <div>
          <h4 className="font-black text-sm uppercase tracking-widest mb-1">Efficiency Pro-Tip</h4>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            {uiLang === 'zh' 
              ? '建议按站点+产品大类（如：US-家居）进行分类，配合刊登模板可以实现一键极速铺货。' 
              : 'Categorize by Site + Type (e.g., US-Home) and use with templates for one-click global distribution.'}
          </p>
        </div>
      </div>
    </div>
  );
};
