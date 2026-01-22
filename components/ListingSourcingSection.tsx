
import React from 'react';
import { Link2, Plus, ExternalLink, Edit2, Trash2, Search } from 'lucide-react';
import { Listing, SourcingRecord } from '../types';

interface ListingSourcingSectionProps {
  listing: Listing;
  updateField: (field: string, value: any) => void;
  setShowModal: (show: boolean) => void;
  setShowForm: (show: boolean) => void;
  setEditingRecord: (record: SourcingRecord | null) => void;
}

export const ListingSourcingSection: React.FC<ListingSourcingSectionProps> = ({
  listing, updateField, setShowModal, setShowForm, setEditingRecord
}) => {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Link2 size={14} className="text-orange-500" /> Sourcing Discovery</h3>
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Plus size={16}/></button>
      </div>
      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
         {(listing.sourcing_data || []).map((s, idx) => (
           <div key={idx} className="group flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 relative">
              <img src={s.image} className="w-10 h-10 rounded-lg object-cover" />
              <div className="flex-1 overflow-hidden">
                 <p className="text-[9px] font-black text-slate-800 truncate">{s.title}</p>
                 <p className="text-[9px] font-bold text-orange-600 uppercase">{s.price}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => { setEditingRecord(s); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                 <button onClick={() => updateField('sourcing_data', (listing.sourcing_data || []).filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={12}/></button>
              </div>
              <a href={s.url} target="_blank" className="p-1.5 text-slate-300 hover:text-blue-500"><ExternalLink size={12}/></a>
           </div>
         ))}
         <button onClick={() => setShowModal(true)} className="w-full py-3 bg-orange-50 text-orange-600 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-100 transition-all"><Search size={14} /> Search 1688</button>
      </div>
    </div>
  );
};
