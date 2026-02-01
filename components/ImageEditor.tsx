
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Save, Undo, Loader2, MousePointer2, Palette, ZoomIn, ZoomOut, Move, 
  Maximize2, Sparkles, Paintbrush, Square, Circle, Type, Scissors, Pipette, 
  Trash2, Layers, Minus, ChevronDown, Eraser, Hand
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'rect_fill' | 'erase';

interface Element {
  id: string;
  type: 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'rect_fill' | 'erase';
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
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  const [showShapeMenu, setShowShapeMenu] = useState(false);

  // 1. 终极加载策略：使用 Blob 绕过跨域污染导致的导出空白问题
  useEffect(() => {
    const loadSecureImage = async () => {
      if (!imageUrl) { setIsProcessing(false); return; }
      setIsProcessing(true);
      try {
        const proxied = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
          ? imageUrl : `${CORS_PROXY}${encodeURIComponent(imageUrl)}?t=${Date.now()}`;
        
        const response = await fetch(proxied);
        if (!response.ok) throw new Error("Secure Fetch failed");
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.src = localUrl;
        
        img.onload = async () => {
          await img.decode(); // 物理像素预解码
          setCanvasImage(img);
          // 初始比例适配
          const scale = Math.min((window.innerWidth - 450) / img.width, (window.innerHeight - 250) / img.height, 1);
          setZoom(scale);
          setOffset({ x: 0, y: 0 });
          setIsProcessing(false);
        };
      } catch (e) {
        console.error("Editor System Crash:", e);
        setIsProcessing(false);
      }
    };
    loadSecureImage();
  }, [imageUrl]);

  // 2. 物理渲染循环
  useEffect(() => {
    draw();
  }, [elements, selectedId, canvasImage, strokeColor, strokeWidth, fontSize]);

  const draw = () => {
    if (!canvasRef.current || !canvasImage) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    
    // 设置物理像素尺寸
    canvasRef.current.width = canvasImage.width;
    canvasRef.current.height = canvasImage.height;
    
    // 绘制底图（物理全图）
    ctx.drawImage(canvasImage, 0, 0);

    // 顺序绘制标注图层
    elements.forEach(el => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'brush' && el.points) {
        ctx.beginPath();
        if (el.points.length > 0) {
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
        }
        ctx.stroke();
      } else if (el.type === 'rect') {
        ctx.strokeRect(el.x, el.y, el.w || 0, el.h || 0);
      } else if (el.type === 'rect_fill') {
        ctx.fillRect(el.x, el.y, el.w || 0, el.h || 0);
      } else if (el.type === 'circle') {
        ctx.beginPath();
        const r = Math.sqrt((el.w||0)**2 + (el.h||0)**2);
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + (el.w || 0), el.y + (el.h || 0)); ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', el.x, el.y);
      } else if (el.type === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        if (el.points) {
           ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y);
           el.points.forEach(p => ctx.lineTo(p.x, p.y));
           ctx.stroke();
        }
      }

      if (el.id === selectedId) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(el.x - 5, el.y - 5, (el.w || 0) + 10, (el.h || 0) + 10);
      }
      ctx.restore();
    });
  };

  // 3. 交互逻辑：坐标转换、缩放、平移
  const getPos = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(0.1, prev * delta), 10));
  };

  const handleStart = (e: React.MouseEvent) => {
    const pos = getPos(e);
    
    // 平移触发条件：Hand工具或Select工具且未点中元素
    if (currentTool === 'hand' || currentTool === 'select') {
      setIsPanning(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      if (currentTool === 'hand') return;
    }

    if (currentTool === 'select') {
      const clicked = [...elements].reverse().find(el => (
        pos.x >= el.x && pos.x <= el.x + (el.w||0) && pos.y >= el.y && pos.y <= el.y + (el.h||0)
      ));
      if (clicked) { setSelectedId(clicked.id); setIsDragging(true); } 
      else { setSelectedId(null); }
      return;
    }

    setIsDragging(true);
    const id = Math.random().toString(36).substr(2, 9);
    const newEl: Element = { 
      id, type: currentTool as any, x: pos.x, y: pos.y, w: 0, h: 0, 
      color: strokeColor, strokeWidth, fontSize, points: ['brush', 'erase'].includes(currentTool) ? [pos] : [] 
    };

    if (currentTool === 'text') {
      const t = prompt("Input Text / 输入文本:");
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

  const handleMove = (e: React.MouseEvent) => {
    const pos = getPos(e);
    
    if (isPanning) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    if (!isDragging || !selectedId) return;

    setElements(elements.map(el => {
      if (el.id !== selectedId) return el;
      if (['brush', 'erase'].includes(el.type)) return { ...el, points: [...(el.points || []), pos] };
      return { ...el, w: pos.x - el.x, h: pos.y - el.y };
    }));
  };

  const handleEnd = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  // 4. 标准化物理引擎：物理 1600x1600 + 1500 居中
  const handleStandardize = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setSelectedId(null);
    
    setTimeout(() => {
      const buffer = document.createElement('canvas');
      buffer.width = 1600;
      buffer.height = 1600;
      const bctx = buffer.getContext('2d')!;
      
      // 1. 物理纯白底
      bctx.fillStyle = '#FFFFFF';
      bctx.fillRect(0, 0, 1600, 1600);
      
      // 2. 1500 居中算法
      const source = canvasRef.current!;
      const scale = Math.min(1500 / source.width, 1500 / source.height);
      const dw = source.width * scale;
      const dh = source.height * scale;
      const dx = (1600 - dw) / 2;
      const dy = (1600 - dh) / 2;
      
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(source, dx, dy, dw, dh);
      
      buffer.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData();
        fd.append('file', blob, `manual_std1600_${Date.now()}.jpg`);
        try {
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (u) onSave(u);
        } catch (e) {
          alert("Network sync error.");
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.98);
    }, 100);
  };

  const handleFinalSave = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setSelectedId(null);
    setTimeout(() => {
      canvasRef.current!.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData();
        fd.append('file', blob, `edited_v4.6_${Date.now()}.jpg`);
        try {
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (u) onSave(u);
        } catch (e) {
          alert("Sync error.");
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.96);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col font-inter overflow-hidden">
      {/* 顶部固定导航 */}
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white shrink-0 z-50 shadow-2xl">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-xs italic">AI</div>
            <span className="font-black text-xs uppercase tracking-widest text-slate-400">Media Studio Pro v4.6</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleStandardize} disabled={isProcessing} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all">
            <Maximize2 size={14}/> Standardize 1600
          </button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-10 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex relative overflow-hidden">
        {/* 左侧固定工具栏 */}
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-5 shrink-0 z-50">
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

        {/* 可视化拖拽平移区 */}
        <div 
          className="flex-1 relative bg-slate-950 cursor-grab active:cursor-grabbing overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
        >
          {isProcessing && (
            <div className="absolute inset-0 z-[60] bg-slate-950/40 backdrop-blur-md flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
              <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Syncing Neural Pixels...</p>
            </div>
          )}
          
          <div 
            style={{ 
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out'
            }} 
            className="inline-block shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
             <canvas ref={canvasRef} className="block" />
          </div>

          <div className="absolute bottom-8 right-8 px-5 py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white/50 shadow-2xl">
            {Math.round(zoom * 100)}% ZOOM
          </div>
        </div>

        {/* 右侧固定属性板 */}
        <div className="w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 shrink-0 z-50 overflow-y-auto">
           <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Brush Width</label>
              <input type="range" min="1" max="100" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500 bg-slate-800 rounded-full appearance-none h-1.5" />
              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase"><span>Fine</span><span>{strokeWidth}px</span><span>Bold</span></div>
           </div>

           <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Text Size</label>
              <input type="range" min="12" max="250" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500 bg-slate-800 rounded-full appearance-none h-1.5" />
              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase"><span>Small</span><span>{fontSize}px</span><span>Large</span></div>
           </div>
           
           <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Color Matrix</label>
              <div className="grid grid-cols-5 gap-2">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff', '#ff8800', '#6366f1'].map(c => (
                   <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                 ))}
              </div>
           </div>

           <div className="pt-8 border-t border-white/5">
              <p className="text-[9px] font-medium text-slate-500 leading-relaxed uppercase opacity-50">
                Tip: Scroll to zoom. <br/>Drag with Left-Click to pan workspace.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-14 flex flex-col items-center gap-1 group transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-2 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter opacity-50 group-hover:opacity-100">{label}</span>
  </button>
);
