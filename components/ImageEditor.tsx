
import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Loader2, MousePointer2, Maximize2, Paintbrush, Square, Circle, Type, Trash2, Eraser, Hand } from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'rect' | 'circle' | 'text' | 'erase';
interface Element { id: string; type: Tool; x: number; y: number; w?: number; h?: number; text?: string; color: string; strokeWidth: number; fontSize: number; points?: {x: number, y: number}[]; }

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [isProcessing, setIsProcessing] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(12);
  const [fontSize, setFontSize] = useState(48);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const initImg = async () => {
      if (!imageUrl) return;
      setIsProcessing(true);
      try {
        const proxied = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
          ? imageUrl : `${CORS_PROXY}${encodeURIComponent(imageUrl)}?t=${Date.now()}`;
        const response = await fetch(proxied);
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer]);
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = objUrl;
        img.onload = async () => {
          await img.decode(); setCanvasImage(img);
          const s = Math.min((window.innerWidth - 600) / img.width, (window.innerHeight - 400) / img.height, 1);
          setZoom(s); setOffset({ x: 0, y: 0 }); setIsProcessing(false);
        };
      } catch (e) { console.error(e); setIsProcessing(false); }
    };
    initImg();
  }, [imageUrl]);

  useEffect(() => {
    if (!canvasRef.current || !canvasImage) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    canvasRef.current.width = canvasImage.width; canvasRef.current.height = canvasImage.height;
    ctx.drawImage(canvasImage, 0, 0);
    elements.forEach(el => {
      ctx.save(); ctx.strokeStyle = el.color; ctx.fillStyle = el.color; ctx.lineWidth = el.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (el.type === 'brush' && el.points) { ctx.beginPath(); if (el.points.length) { ctx.moveTo(el.points[0].x, el.points[0].y); el.points.forEach(p => ctx.lineTo(p.x, p.y)); } ctx.stroke(); }
      else if (el.type === 'rect') { ctx.strokeRect(el.x, el.y, el.w || 0, el.h || 0); }
      else if (el.type === 'circle') { ctx.beginPath(); const r = Math.sqrt((el.w||0)**2 + (el.h||0)**2); ctx.arc(el.x, el.y, r, 0, Math.PI * 2); ctx.stroke(); }
      else if (el.type === 'text') { ctx.font = `bold ${el.fontSize}px Inter, sans-serif`; ctx.textBaseline = 'top'; ctx.fillText(el.text || '', el.x, el.y); }
      else if (el.type === 'erase') { ctx.globalCompositeOperation = 'destination-out'; if (el.points) { ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y); el.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); } }
      if (el.id === selectedId) { ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([5, 5]); ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2 / zoom; ctx.strokeRect(el.x - 5, el.y - 5, (el.w || 0) + 10, (el.h || 0) + 10); }
      ctx.restore();
    });
  }, [elements, selectedId, canvasImage, strokeColor, strokeWidth, zoom]);

  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); const d = e.deltaY > 0 ? 0.9 : 1.1; setZoom(p => Math.min(Math.max(0.05, p * d), 20)); };
  const handleStart = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    if (currentTool === 'hand' || currentTool === 'select') { setIsPanning(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); if (currentTool === 'hand') return; }
    if (currentTool === 'select') { const clicked = [...elements].reverse().find(el => (pos.x >= el.x && pos.x <= el.x + (el.w||0) && pos.y >= el.y && pos.y <= el.y + (el.h||0))); if (clicked) { setSelectedId(clicked.id); setIsDragging(true); } else { setSelectedId(null); } return; }
    setIsDragging(true); const id = Math.random().toString(36).substr(2, 9);
    const newEl: Element = { id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0, color: strokeColor, strokeWidth, fontSize, points: ['brush', 'erase'].includes(currentTool) ? [pos] : [] };
    if (currentTool === 'text') { const t = prompt("Text Content:"); if (!t) { setIsDragging(false); return; } newEl.text = t; setElements([...elements, newEl]); setSelectedId(id); setIsDragging(false); }
    else { setElements([...elements, newEl]); setSelectedId(id); }
  };

  const handleMove = (e: React.MouseEvent) => {
    if (isPanning) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    if (!isDragging || !selectedId) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    setElements(elements.map(el => { if (el.id !== selectedId) return el; if (['brush', 'erase'].includes(el.type)) return { ...el, points: [...(el.points || []), pos] }; return { ...el, w: pos.x - el.x, h: pos.y - el.y }; }));
  };

  const sync = async (type: string) => {
    if (!canvasRef.current) return;
    setIsProcessing(true); setSelectedId(null);
    setTimeout(() => {
      const buffer = document.createElement('canvas'); 
      if (type === 'std') { buffer.width = 1600; buffer.height = 1600; const bctx = buffer.getContext('2d')!; bctx.fillStyle = '#FFFFFF'; bctx.fillRect(0, 0, 1600, 1600); const scale = Math.min(1500 / canvasRef.current!.width, 1500 / canvasRef.current!.height); const dw = canvasRef.current!.width * scale, dh = canvasRef.current!.height * scale; bctx.drawImage(canvasRef.current!, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh); }
      else { buffer.width = canvasRef.current!.width; buffer.height = canvasRef.current!.height; buffer.getContext('2d')!.drawImage(canvasRef.current!, 0, 0); }
      buffer.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData(); fd.append('file', blob, `edit_${Date.now()}.jpg`);
        try { const res = await fetch(TARGET_API, { method: 'POST', body: fd }); const data = await res.json(); const url = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url; if (url) onSave(url); } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.98);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col font-inter overflow-hidden">
      {/* 顶部工具栏 - 强行固定 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white z-[300] shadow-2xl">
        <div className="flex items-center gap-6"><button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button><span className="font-black text-xs uppercase tracking-widest text-indigo-400">Media Engine v4.8</span></div>
        <div className="flex items-center gap-4">
          <button onClick={() => sync('std')} disabled={isProcessing} className="px-6 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all hover:bg-slate-700"><Maximize2 size={14}/> Standardize 1600</button>
          <button onClick={() => sync('final')} disabled={isProcessing} className="px-10 py-2.5 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">{isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync</button>
        </div>
      </div>
      
      <div className="flex-1 flex pt-16 relative">
        {/* 左侧工具栏 - 强行固定 */}
        <div className="fixed left-0 top-16 bottom-0 w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-5 z-[300]">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Move" />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={18}/>} label="Pan" />
           <div className="w-8 h-px bg-white/10 my-2"></div>
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={18}/>} label="Brush" />
           <SideBtn active={currentTool === 'rect'} onClick={() => setCurrentTool('rect')} icon={<Square size={18}/>} label="Rect" />
           <SideBtn active={currentTool === 'circle'} onClick={() => setCurrentTool('circle')} icon={<Circle size={18}/>} label="Circle" />
           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} label="Text" />
           <SideBtn active={currentTool === 'erase'} onClick={() => setCurrentTool('erase')} icon={<Eraser size={18}/>} label="Eraser" />
           <button onClick={() => { if(selectedId) setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500 mt-auto"><Trash2 size={20}/></button>
        </div>

        {/* 交互工作区 */}
        <div className="flex-1 bg-slate-950 cursor-crosshair overflow-hidden relative" onWheel={handleWheel} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={() => { setIsDragging(false); setIsPanning(false); }} onMouseLeave={() => { setIsDragging(false); setIsPanning(false); }}>
          {isProcessing && <div className="absolute inset-0 z-[400] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-500 mb-4" size={48} /><p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Syncing Neural Workspace...</p></div>}
          <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: 'center', transition: isPanning ? 'none' : 'transform 0.1s ease-out' }} className="inline-block shadow-[0_0_100px_rgba(0,0,0,0.8)] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><canvas ref={canvasRef} className="block" /></div>
          <div className="absolute bottom-8 right-72 px-5 py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white/50">{Math.round(zoom * 100)}% ZOOM</div>
        </div>

        {/* 右侧属性栏 - 强行固定 */}
        <div className="fixed right-0 top-16 bottom-0 w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 z-[300] overflow-y-auto">
           <div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Brush/Line Width</label><input type="range" min="1" max="150" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none" /></div>
           <div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Text Size</label><input type="range" min="12" max="300" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none" /></div>
           <div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Color Matrix</label><div className="grid grid-cols-5 gap-2">{['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff', '#ff8800', '#6366f1'].map(c => (<button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />))}</div></div>
           <div className="pt-10 border-t border-white/5 opacity-50"><p className="text-[9px] font-medium text-slate-400 leading-relaxed uppercase">Tip: Scroll for zoom. <br/>Left-Click Hand/Move to pan.</p></div>
        </div>
      </div>
    </div>
  );
};
const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-14 flex flex-col items-center gap-1 group transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-2 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">{label}</span>
  </button>
);
