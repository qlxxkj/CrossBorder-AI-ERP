
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Save, Undo, Loader2, MousePointer2, Palette, ZoomIn, ZoomOut, Move, 
  Maximize2, Sparkles, Paintbrush, Square, Circle, Type, Scissors, Pipette, 
  Trash2, Layers, Minus
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'rect_fill' | 'pan';

interface Element {
  id: string;
  type: Tool;
  x: number; y: number;
  w?: number; h?: number;
  text?: string;
  color: string;
  size: number;
  points?: {x: number, y: number}[];
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!imageUrl) return;
      setIsProcessing(true);
      try {
        const proxied = imageUrl.startsWith('http') ? `${CORS_PROXY}${encodeURIComponent(imageUrl)}` : imageUrl;
        const res = await fetch(proxied);
        const blob = await res.blob();
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
          setCanvasImage(img);
          const fitZoom = Math.min((window.innerWidth-500)/img.width, (window.innerHeight-200)/img.height, 1);
          setZoom(fitZoom);
          setIsProcessing(false);
        };
      } catch (e) { setIsProcessing(false); }
    };
    init();
  }, [imageUrl]);

  useEffect(() => {
    draw();
  }, [elements, selectedId, zoom, canvasImage]);

  const draw = () => {
    if (!canvasRef.current || !canvasImage) return;
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width = canvasImage.width;
    canvasRef.current.height = canvasImage.height;
    ctx.drawImage(canvasImage, 0, 0);

    elements.forEach(el => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.id === selectedId) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#00f';
        ctx.lineWidth = 2;
      }

      if (el.type === 'brush' && el.points) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (el.type === 'rect') {
        ctx.strokeRect(el.x, el.y, el.w || 0, el.h || 0);
      } else if (el.type === 'rect_fill') {
        ctx.fillRect(el.x, el.y, el.w || 0, el.h || 0);
      } else if (el.type === 'circle') {
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.w || 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + (el.w || 0), el.y + (el.h || 0)); ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.size * 3}px Inter`;
        ctx.fillText(el.text || '', el.x, el.y);
      }

      if (el.id === selectedId) {
        if (el.type === 'rect' || el.type === 'rect_fill') ctx.strokeRect(el.x - 5, el.y - 5, (el.w || 0) + 10, (el.h || 0) + 10);
        ctx.restore();
      }
    });
  };

  const getPos = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };

  const handleStart = (e: any) => {
    const pos = getPos(e);
    if (currentTool === 'select') {
      const clicked = [...elements].reverse().find(el => {
        if (el.type === 'rect' || el.type === 'rect_fill') return pos.x >= el.x && pos.x <= el.x + (el.w||0) && pos.y >= el.y && pos.y <= el.y + (el.h||0);
        if (el.type === 'text') return Math.abs(pos.x - el.x) < 50 && Math.abs(pos.y - el.y) < 50;
        return false;
      });
      if (clicked) {
        setSelectedId(clicked.id);
        setIsDragging(true);
        setDragStart({ x: pos.x - clicked.x, y: pos.y - clicked.y });
      } else {
        setSelectedId(null);
      }
      return;
    }

    setIsDragging(true);
    const id = Math.random().toString(36).substr(2, 9);
    const newEl: Element = { id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0, color: strokeColor, size: strokeWidth, points: currentTool === 'brush' ? [pos] : [] };
    
    if (currentTool === 'text') {
      const t = prompt(uiLang === 'zh' ? "输入文字内容" : "Enter text content");
      if (!t) { setIsDragging(false); return; }
      newEl.text = t;
      setElements([...elements, newEl]);
      setSelectedId(id);
      setIsDragging(false);
    } else {
      setElements([...elements, newEl]);
      setSelectedId(id);
    }
  };

  const handleMove = (e: any) => {
    if (!isDragging || !selectedId) return;
    const pos = getPos(e);
    setElements(elements.map(el => {
      if (el.id !== selectedId) return el;
      if (currentTool === 'select') return { ...el, x: pos.x - dragStart.x, y: pos.y - dragStart.y };
      if (el.type === 'brush') return { ...el, points: [...(el.points || []), pos] };
      return { ...el, w: pos.x - el.x, h: pos.y - el.y };
    }));
  };

  const handleEnd = () => setIsDragging(false);

  const handleDelete = () => {
    if (selectedId) {
      setElements(elements.filter(el => el.id !== selectedId));
      setSelectedId(null);
    }
  };

  const handleFinalSave = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    // 取消选中状态再导出
    const oldId = selectedId;
    setSelectedId(null);
    setTimeout(() => {
      canvasRef.current!.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData();
        fd.append('file', blob, `edit_${Date.now()}.jpg`);
        try {
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (u) onSave(u);
        } catch (e) { alert("Upload Failed"); }
        finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.95);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col font-inter">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
          <span className="font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent italic">Layered AI Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit & Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-4">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Move" />
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={18}/>} label="Brush" />
           <SideBtn active={currentTool === 'rect'} onClick={() => setCurrentTool('rect')} icon={<Square size={18}/>} label="Rect" />
           <SideBtn active={currentTool === 'rect_fill'} onClick={() => setCurrentTool('rect_fill')} icon={<Layers size={18}/>} label="Fill" />
           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} label="Text" />
           <div className="w-8 h-px bg-white/10 my-2"></div>
           <button onClick={handleDelete} disabled={!selectedId} className="p-3 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center p-10 custom-scrollbar">
          <div 
            onMouseDown={handleStart} 
            onMouseMove={handleMove} 
            onMouseUp={handleEnd} 
            onMouseLeave={handleEnd}
            style={{ transform: `scale(${zoom})`, cursor: currentTool === 'select' ? 'default' : 'crosshair' }} 
            className="shadow-[0_0_100px_rgba(0,0,0,0.6)] bg-white relative transition-transform duration-75 origin-center"
          >
             <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        <div className="w-72 bg-slate-900 border-l border-white/5 p-6 space-y-8 overflow-y-auto custom-scrollbar">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Brush & Text Size</label>
              <input type="range" min="1" max="100" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase"><span>Fine</span><span>{strokeWidth}px</span><span>Bold</span></div>
           </div>
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Color Palette</label>
              <div className="grid grid-cols-5 gap-2">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#000000', '#ffffff', '#ff8800', '#00ffee', '#8800ff'].map(c => (
                   <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                 ))}
              </div>
           </div>
           <div className="p-5 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
              <p className="text-[9px] font-bold text-indigo-400 leading-relaxed uppercase">
                Pro Tip: Elements added with 'Rect', 'Fill', or 'Text' tools can be moved or deleted using the 'Move' tool.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 group transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-1 ring-indigo-500' : 'bg-white/5 group-hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);
