
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Loader2, X, FileText, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { BrandWord, UILanguage } from '../types';
import * as XLSX from 'xlsx';

interface BrandWordManagerProps {
  orgId: string;
  uiLang: UILanguage;
}

export const BrandWordManager: React.FC<BrandWordManagerProps> = ({ orgId, uiLang }) => {
  const [brandWords, setBrandWords] = useState<BrandWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchBrandWords();
  }, [orgId]);

  const fetchBrandWords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_words')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBrandWords(data || []);
    } catch (err) {
      console.error('Error fetching brand words:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('brand_words')
        .insert([{ org_id: orgId, word: newWord.trim() }]);
      if (error) throw error;
      setNewWord('');
      fetchBrandWords();
    } catch (err) {
      console.error('Error adding brand word:', err);
      alert(uiLang === 'zh' ? '添加失败' : 'Add failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWord = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('brand_words')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchBrandWords();
    } catch (err) {
      console.error('Error deleting brand word:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const words = data
          .flat()
          .map(w => String(w).trim())
          .filter(w => w && w !== 'undefined' && w !== 'null' && w.length > 0);

        if (words.length === 0) {
          alert(uiLang === 'zh' ? '未发现有效品牌词' : 'No valid brand words found');
          return;
        }

        const uniqueWords = Array.from(new Set(words));
        const inserts = uniqueWords.map(w => ({ org_id: orgId, word: w }));

        const { error } = await supabase.from('brand_words').insert(inserts);
        if (error) throw error;

        alert(uiLang === 'zh' ? `成功导入 ${uniqueWords.length} 个品牌词` : `Successfully imported ${uniqueWords.length} brand words`);
        fetchBrandWords();
      } catch (err) {
        console.error('Error uploading file:', err);
        alert(uiLang === 'zh' ? '导入失败' : 'Import failed');
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredWords = brandWords.filter(bw => bw.word.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-10 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
            <FileText className="text-indigo-600" size={18} /> 
            {uiLang === 'zh' ? '品牌词管理' : 'Brand Word Management'}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">AI optimization will remove these words from output</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder={uiLang === 'zh' ? '搜索品牌词...' : 'Search words...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <label className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all cursor-pointer">
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14}/>} 
            {uiLang === 'zh' ? '批量上传' : 'Bulk Upload'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <form onSubmit={handleAddWord} className="flex gap-3">
        <input 
          type="text" 
          placeholder={uiLang === 'zh' ? '输入品牌词...' : 'Enter brand word...'}
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/5 outline-none"
        />
        <button 
          type="submit" 
          disabled={loading || !newWord.trim()}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          <Plus size={18} />
        </button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredWords.map(bw => (
          <div key={bw.id} className="group flex items-center justify-between px-4 py-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-500 transition-all">
            <span className="text-xs font-bold text-slate-700 truncate mr-2">{bw.word}</span>
            <button 
              onClick={() => handleDeleteWord(bw.id)}
              className="text-slate-300 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {filteredWords.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">No brand words found</p>
          </div>
        )}
      </div>
    </div>
  );
};
