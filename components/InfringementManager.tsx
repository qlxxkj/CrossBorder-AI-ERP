
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Loader2, X, FileText, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { InfringementWord, UILanguage } from '../types';
import * as XLSX from 'xlsx';

interface InfringementManagerProps {
  orgId: string;
  uiLang: UILanguage;
}

export const InfringementManager: React.FC<InfringementManagerProps> = ({ orgId, uiLang }) => {
  const [infringementWords, setInfringementWords] = useState<InfringementWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchInfringementWords();
  }, [orgId]);

  const fetchInfringementWords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('infringement_words')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInfringementWords(data || []);
    } catch (err) {
      console.error('Error fetching infringement words:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setLoading(true);
    try {
      const words = newWord
        .split('\n')
        .map(w => w.trim())
        .filter(w => w.length > 0);

      if (words.length === 0) return;

      // Filter out duplicates that might already exist in the local state to avoid DB errors if unique constraint exists
      const existingWords = new Set(infringementWords.map(bw => bw.word.toLowerCase()));
      const newUniqueWords = Array.from(new Set(words)).filter(w => !existingWords.has(w.toLowerCase()));

      if (newUniqueWords.length === 0) {
        setNewWord('');
        return;
      }

      const inserts = newUniqueWords.map(w => ({ org_id: orgId, word: w }));
      const { error } = await supabase.from('infringement_words').insert(inserts);
      
      if (error) throw error;
      setNewWord('');
      fetchInfringementWords();
    } catch (err) {
      console.error('Error adding infringement words:', err);
      alert(uiLang === 'zh' ? '添加失败' : 'Add failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWord = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('infringement_words')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchInfringementWords();
    } catch (err) {
      console.error('Error deleting infringement word:', err);
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
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const words = data
          .flat()
          .map(w => String(w).trim())
          .filter(w => w && w !== 'undefined' && w !== 'null' && w.length > 0);

        if (words.length === 0) {
          alert(uiLang === 'zh' ? '未发现有效侵权词' : 'No valid infringement words found');
          return;
        }

        // Filter out duplicates locally and against existing words
        const existingWordsSet = new Set(infringementWords.map(bw => bw.word.toLowerCase()));
        const uniqueWords = Array.from(new Set(words)).filter(w => !existingWordsSet.has(w.toLowerCase()));

        if (uniqueWords.length === 0) {
          alert(uiLang === 'zh' ? '所选词汇已全部存在' : 'All selected words already exist');
          return;
        }

        const inserts = uniqueWords.map(w => ({ org_id: orgId, word: w }));

        const { error } = await supabase.from('infringement_words').insert(inserts);
        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        alert(uiLang === 'zh' ? `成功导入 ${uniqueWords.length} 个侵权词` : `Successfully imported ${uniqueWords.length} infringement words`);
        fetchInfringementWords();
      } catch (err: any) {
        console.error('Error uploading file:', err);
        const errorMsg = err.message || (uiLang === 'zh' ? '导入失败' : 'Import failed');
        alert(uiLang === 'zh' ? `导入失败: ${errorMsg}` : `Import failed: ${errorMsg}`);
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredWords = infringementWords.filter(bw => bw.word.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-10 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
            <FileText className="text-indigo-600" size={18} /> 
            {uiLang === 'zh' ? '侵权管理' : 'Infringement Management'}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">AI optimization will remove these words from output</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder={uiLang === 'zh' ? '搜索侵权词...' : 'Search words...'}
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

      <form onSubmit={handleAddWord} className="flex flex-col gap-4">
        <textarea 
          placeholder={uiLang === 'zh' ? '输入侵权词，每行一个...' : 'Enter infringement words, one per line...'}
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          rows={3}
          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/5 outline-none resize-none"
        />
        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={loading || !newWord.trim()}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={18} />
            {uiLang === 'zh' ? '确认新增' : 'Confirm Add'}
          </button>
        </div>
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
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">No infringement words found</p>
          </div>
        )}
      </div>
    </div>
  );
};
