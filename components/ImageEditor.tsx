
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Save, Undo, Loader2, MousePointer2, Palette, ZoomIn, ZoomOut, Move, 
  Maximize2, Sparkles, Paintbrush, Square, Circle, Type, Scissors, Pipette, 
  Trash2, Layers, Minus, ChevronDown, Eraser
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'rect_fill' | 'erase';

interface Element {
  id: string;
  type: Tool;
  x: number; y: number;
  w?: number; h?: number;
  text?: string;
  color: string;
  strokeWidth: number;
  fontSize: number;
  points?: {x: number, y: number}[];
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [isProcessing, setIsProcessing] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(15);
  const [fontSize, setFontSize] = useState(48);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [lastShape, setLastShape] = useState<Tool>('rect');

  useEffect(() => {
    const init = async () => {
      if (!imageUrl) { setIsProcessing(false); return; }
      setIsProcessing(true);
      try {
        const proxied = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
          ? imageUrl : `${CORS_PROXY}${encodeURIComponent(imageUrl)}?v=${Date.now()}`;
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = proxied;
        
        img.onload = () => {
          setCanvasImage(img);
          const fitZoom = Math.min((window.innerWidth-700)/img.width, (window.innerHeight-350)/img.height, 1);
          setZoom(fitZoom);
          setIsProcessing(false);
        };
        img.onerror = () => setIsProcessing(false);
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
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

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
        ctx.arc(el.x, el.y, Math.abs(el.w || 0), 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + (el.w || 0), el.y + (el.h || 0)); ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.fillText(el.text || '', el.x, el.y);
      } else if (el.type === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        if (el.points) {
           ctx.beginPath();
           ctx.moveTo(el.points[0].x, el.points[0].y);
           el.points.forEach(p => ctx.lineTo(p.x, p.y));
           ctx.stroke();
        }
      }

      if (el.id === selectedId) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        if (el.type === 'rect' || el.type === 'rect_fill') ctx.strokeRect(el.x - 5, el.y - 5, (el.w || 0) + 10, (el.h || 0) + 10);
        else ctx.strokeRect(el.x - 20, el.y - 20, 40, 40);
      }
      ctx.restore();
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
        return Math.abs(pos.x - el.x) < 50 && Math.abs(pos.y - el.y) < 50;
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
    const newEl: Element = { id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0, color: strokeColor, strokeWidth, fontSize, points: ['brush', 'erase'].includes(currentTool) ? [pos] : [] };
    
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
      if (['brush', 'erase'].includes(el.type)) return { ...el, points: [...(el.points || []), pos] };
      return { ...el, w: pos.x - el.x, h: pos.y - el.y };
    }));
  };

  const handleEnd = () => setIsDragging(false);

  const handleStandardize = () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    const buffer = document.createElement('canvas');
    buffer.width = 1600;
    buffer.height = 1600;
    const bCtx = buffer.getContext('2d')!;
    bCtx.fillStyle = '#FFFFFF';
    bCtx.fillRect(0,0,1600,1600);
    const targetLimit = 1500;
    const scale = Math.min(targetLimit / canvasRef.current.width, targetLimit / canvasRef.current.height);
    const dw = canvasRef.current.width * scale;
    const dh = canvasRef.current.height * scale;
    bCtx.drawImage(canvasRef.current, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh);
    const img = new Image();
    img.src = buffer.toDataURL('image/jpeg', 0.98);
    img.onload = () => {
      setCanvasImage(img);
      setElements([]);
      setZoom(Math.min((window.innerWidth-700)/1600, (window.innerHeight-350)/1600, 1));
      setIsProcessing(false);
    };
  };

  const pickColor = async () => {
    if (!(window as any).EyeDropper) return;
    const dropper = new (window as any).EyeDropper();
    try { const res = await dropper.open(); setStrokeColor(res.sRGBHex); } catch (e) {}
  };

  const handleFinalSave = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setSelectedId(null);
    setTimeout(() => {
      canvasRef.current!.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData();
        fd.append('file', blob, `ai_edit_${Date.now()}.jpg`);
        try {
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (u) onSave(u);
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.96);
    }, 100);
  };

  const ShapeIcon = () => {
    if (lastShape === 'rect') return <Square size={18} />;
    if (lastShape === 'circle') return <Circle size={18} />;
    return <Minus size={18} />;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col font-inter">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-xs italic">AI</div>
            <span className="font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">AI Media Studio Pro</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleStandardize} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/10 transition-all"><Maximize2 size={14}/> 1600px Standardize</button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-10 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-500/20 transition-all">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-24 bg-slate-900 border-r border-white/5 flex flex-col items-center py-8 gap-6">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Move" />
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={18}/>} label="Brush" />
           <div className="relative">
             <SideBtn active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={<ShapeIcon />} label="Shapes" />
             {showShapeMenu && (
               <div className="absolute left-full top-0 ml-4 bg-slate-800 border border-slate-700 rounded-2xl p-2 z-[210] flex flex-col gap-1">
                  <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); }} className={`p-4 rounded-xl transition-all ${currentTool === 'rect' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}><Square size={18}/></button>
                  <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); }} className={`p-4 rounded-xl transition-all ${currentTool === 'circle' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}><Circle size={18}/></button>
                  <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); }} className={`p-4 rounded-xl transition-all ${currentTool === 'line' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}><Minus size={18}/></button>
               </div>
             )}
           </div>
           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} label="Text" />
           <SideBtn active={currentTool === 'rect_fill'} onClick={() => setCurrentTool('rect_fill')} icon={<Layers size={18}/>} label="Fill" />
           <SideBtn active={currentTool === 'erase'} onClick={() => setCurrentTool('erase')} icon={<Eraser size={18}/>} label="AI Erase" />
           <div className="w-10 h-px bg-white/10 my-2"></div>
           <SideBtn active={false} onClick={pickColor} icon={<Pipette size={18} className="text-amber-400"/>} label="Pipette" />
           <button onClick={() => { if(selectedId) setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); }} disabled={!selectedId} className="p-3 text-slate-500 hover:text-red-500 transition-all"><Trash2 size={20}/></button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center p-10">
          {isProcessing && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
              <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">{uiLang === 'zh' ? '正在同步像素数据...' : 'Synching Pixel Data...'}</p>
            </div>
          )}
          <div 
            onMouseDown={handleStart} 
            onMouseMove={handleMove} 
            onMouseUp={handleEnd} 
            onMouseLeave={handleEnd}
            style={{ transform: `scale(${zoom})`, cursor: currentTool === 'select' ? 'default' : 'crosshair' }} 
            className="shadow-[0_0_150px_rgba(0,0,0,0.8)] bg-white relative transition-transform duration-100 origin-center"
          >
             <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        <div className="w-80 bg-slate-900 border-l border-white/5 p-8 space-y-10 overflow-y-auto">
           <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">Brush Size</label>
              <input type="range" min="1" max="100" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
              <div className="flex justify-between text-[8px] font-black text-slate-600"><span>Fine</span><span>{strokeWidth}px</span><span>Bold</span></div>
           </div>
           
           <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">Text Font Size</label>
              <input type="range" min="12" max="200" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
              <div className="flex justify-between text-[8px] font-black text-slate-600"><span>Small</span><span>{fontSize}px</span><span>Large</span></div>
           </div>
           
           <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">Color Matrix</label>
              <div className="grid grid-cols-5 gap-3">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff', '#ff8800', '#6366f1'].map(c => (
                   <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-xl border-4 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-xl' : 'border-transparent opacity-60 hover:opacity-100'}`} />
                 ))}
              </div>
           </div>

           <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl">
              <div className="flex items-center gap-3 text-indigo-400 mb-2">
                <Sparkles size={18}/>
                <span className="text-[10px] font-black uppercase tracking-widest">Studio Tip</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                {uiLang === 'zh' ? '笔触粗细与字体大小现已独立控制。使用“AI擦除”配合标准化功能可快速生成完美合规的主图。' : 'Brush and font sizes are now independent. Use "AI Erase" with Standardize for perfect compliance.'}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-16 flex flex-col items-center gap-1.5 group transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-2 ring-indigo-500 shadow-lg' : 'bg-white/5 group-hover:bg-white/10 group-active:scale-90'}`}>{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter opacity-50 group-hover:opacity-100">{label}</span>
  </button>
);
