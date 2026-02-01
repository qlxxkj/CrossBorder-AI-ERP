
import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Loader2, MousePointer2, Maximize2, Paintbrush, Square, Circle, Type, Trash2, Eraser, Hand, Minus, ChevronDown, Palette } from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'erase';
interface Element { 
  id: string; 
  type: Tool; 
  x: number; 
  y: number; 
  w?: number; 
  h?: number; 
  text?: string; 
  color: string; 
  fillColor: string; 
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
  const [lastShape, setLastShape] = useState<Tool>('rect');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // 属性状态
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [fontSize, setFontSize] = useState(48);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);

  // 1. 初始化加载图片核心逻辑 (修复图片无法显示问题)
  useEffect(() => {
    const loadImage = async () => {
      if (!imageUrl) return;
      setIsProcessing(true);
      try {
        const proxiedUrl = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
          ? imageUrl 
          : `${CORS_PROXY}${encodeURIComponent(imageUrl)}?t=${Date.now()}`;
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = (e) => reject(new Error("Editor Load Fail"));
          img.src = proxiedUrl;
        });
        
        setCanvasImage(img);
        const scale = Math.min((window.innerWidth - 600) / img.width, (window.innerHeight - 300) / img.height, 1);
        setZoom(scale);
        setIsProcessing(false);
      } catch (e) {
        console.error("Editor Error:", e);
        setIsProcessing(false);
      }
    };
    loadImage();
  }, [imageUrl]);

  // 2. 联动系统：属性变化实时同步到选中元素
  useEffect(() => {
    if (selectedId) {
      setElements(prev => prev.map(el => 
        el.id === selectedId ? { ...el, color: strokeColor, fillColor, strokeWidth, fontSize } : el
      ));
    }
  }, [strokeColor, fillColor, strokeWidth, fontSize, selectedId]);

  // 3. 画布重绘逻辑
  useEffect(() => {
    if (!canvasRef.current || !canvasImage) return;
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width = canvasImage.width;
    canvasRef.current.height = canvasImage.height;
    
    // 底图
    ctx.drawImage(canvasImage, 0, 0);
    
    // 图层绘制
    elements.forEach(el => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.fillColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'brush' && el.points) {
        ctx.beginPath();
        if (el.points.length) {
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
        }
        ctx.stroke();
      } else if (el.type === 'rect') {
        if (el.fillColor !== 'transparent') ctx.fillRect(el.x, el.y, el.w || 0, el.h || 0);
        ctx.strokeRect(el.x, el.y, el.w || 0, el.h || 0);
      } else if (el.type === 'circle') {
        const r = Math.sqrt((el.w || 0) ** 2 + (el.h || 0) ** 2);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        if (el.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + (el.w || 0), el.y + (el.h || 0)); ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', el.x, el.y);
      } else if (el.type === 'erase' && el.points) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }

      if (el.id === selectedId) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 4 / zoom;
        ctx.strokeRect(el.x - 5, el.y - 5, (el.w || 0) + 10, (el.h || 0) + 10);
      }
      ctx.restore();
    });
  }, [elements, selectedId, canvasImage, zoom]);

  const handleStart = (e: React.MouseEvent) => {
    if (!canvasRef.current || isProcessing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    
    if (currentTool === 'hand') { 
      setIsPanning(true); 
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); 
      return; 
    }
    
    if (currentTool === 'select') { 
      const clicked = [...elements].reverse().find(el => {
        const xMin = Math.min(el.x, el.x + (el.w || 0)), xMax = Math.max(el.x, el.x + (el.w || 0));
        const yMin = Math.min(el.y, el.y + (el.h || 0)), yMax = Math.max(el.y, el.y + (el.h || 0));
        return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
      });
      if (clicked) { 
        setSelectedId(clicked.id); 
        setStrokeColor(clicked.color);
        setFillColor(clicked.fillColor);
        setStrokeWidth(clicked.strokeWidth);
        setFontSize(clicked.fontSize);
        setIsDragging(true); 
      } else setSelectedId(null); 
      return; 
    }
    
    setIsDragging(true); 
    const id = Math.random().toString(36).substr(2, 9);
    const newEl: Element = { 
      id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0, 
      color: strokeColor, fillColor, strokeWidth, fontSize, 
      points: ['brush', 'erase'].includes(currentTool) ? [pos] : [] 
    };
    
    if (currentTool === 'text') { 
      const t = prompt("Input Text:"); 
      if (!t) { setIsDragging(false); return; } 
      newEl.text = t; newEl.w = 100; newEl.h = 40;
      setElements([...elements, newEl]); 
      setSelectedId(id); setIsDragging(false); 
    } else { 
      setElements([...elements, newEl]); 
      setSelectedId(id); 
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    if (isPanning) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    if (!isDragging || !selectedId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    setElements(prev => prev.map(el => { 
      if (el.id !== selectedId) return el; 
      if (['brush', 'erase'].includes(el.type)) return { ...el, points: [...(el.points || []), pos] }; 
      return { ...el, w: pos.x - el.x, h: pos.y - el.y }; 
    }));
  };

  const commitSync = async (isStandardized: boolean) => {
    if (!canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    setSelectedId(null);
    
    setTimeout(() => {
      const exportCanvas = document.createElement('canvas'); 
      const bctx = exportCanvas.getContext('2d')!;
      if (isStandardized) { 
        exportCanvas.width = 1600; exportCanvas.height = 1600; 
        bctx.fillStyle = '#FFFFFF'; bctx.fillRect(0, 0, 1600, 1600); 
        const scale = Math.min(1500 / canvasRef.current!.width, 1500 / canvasRef.current!.height); 
        const dw = canvasRef.current!.width * scale, dh = canvasRef.current!.height * scale; 
        bctx.drawImage(canvasRef.current!, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh); 
      } else { 
        exportCanvas.width = canvasRef.current!.width; exportCanvas.height = canvasRef.current!.height; 
        bctx.drawImage(canvasRef.current!, 0, 0); 
      }
      
      exportCanvas.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData(); fd.append('file', blob, `studio_${Date.now()}.jpg`);
        try { 
          const res = await fetch(TARGET_API, { method: 'POST', body: fd }); 
          const data = await res.json(); 
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url); 
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.98);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col font-inter overflow-hidden">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white z-[300]">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
          <span className="font-black text-xs uppercase tracking-widest text-indigo-400">Media Studio v6.0</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => commitSync(true)} disabled={isProcessing} className="px-6 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase border border-white/10"><Maximize2 size={14} className="inline mr-2"/> Standardize 1600</button>
          <button onClick={() => commitSync(false)} disabled={isProcessing} className="px-10 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700">
            {isProcessing ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="inline mr-2"/>} Commit Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧工具栏 */}
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-[300]">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={20}/>} label="Move" />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={20}/>} label="Pan" />
           <div className="w-8 h-px bg-white/10"></div>
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={20}/>} label="Brush" />
           
           {/* 图形组 (带折叠) */}
           <div className="relative group">
              <button 
                onClick={() => { setCurrentTool(lastShape); setShowShapeMenu(!showShapeMenu); }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${['rect','circle','line'].includes(currentTool) ? 'bg-indigo-600/20 text-indigo-400 ring-2 ring-indigo-500' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
              >
                {lastShape === 'rect' ? <Square size={20}/> : lastShape === 'circle' ? <Circle size={20}/> : <Minus size={20} className="rotate-45" />}
                <ChevronDown size={8} className="absolute bottom-1 right-1 opacity-50" />
              </button>
              {showShapeMenu && (
                <div className="absolute left-full ml-3 top-0 bg-slate-800 border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col gap-2 z-[400]">
                   <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); }} className="p-3 hover:bg-white/10 rounded-xl text-slate-400"><Square size={20}/></button>
                   <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); }} className="p-3 hover:bg-white/10 rounded-xl text-slate-400"><Circle size={20}/></button>
                   <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); }} className="p-3 hover:bg-white/10 rounded-xl text-slate-400"><Minus size={20} className="rotate-45"/></button>
                </div>
              )}
              <span className="text-[7px] font-black uppercase text-slate-500 mt-1">Shapes</span>
           </div>

           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={20}/>} label="Text" />
           <SideBtn active={currentTool === 'erase'} onClick={() => setCurrentTool('erase')} icon={<Eraser size={20}/>} label="Eraser" />
           
           <div className="w-8 h-px bg-white/10 mt-auto mb-4"></div>
           <button onClick={() => { if(selectedId) setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500"><Trash2 size={20}/></button>
        </div>

        {/* 交互区 */}
        <div 
          className="flex-1 bg-slate-950 cursor-crosshair overflow-hidden relative" 
          onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={() => setIsDragging(false)}
          onWheel={e => setZoom(z => Math.min(10, Math.max(0.1, z * (e.deltaY > 0 ? 0.9 : 1.1))))}
        >
          {isProcessing && <div className="absolute inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-500 mb-4" size={48}/><p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Hydrating Core Engine...</p></div>}
          <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: 'center' }} className="inline-block shadow-[0_0_100px_rgba(0,0,0,1)] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        {/* 右侧属性面板 */}
        <div className="w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 z-[300] overflow-y-auto text-white">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Stroke Width</label>
              <input type="range" min="1" max="100" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none" />
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-2"><Palette size={12}/> Stroke Color</label>
              <div className="grid grid-cols-5 gap-2">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#ff8800', '#ec4899', '#10b981'].map(c => (
                   <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'}`} />
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-2"><Palette size={12}/> Fill Color</label>
              <div className="grid grid-cols-5 gap-2">
                 <button onClick={() => setFillColor('transparent')} className={`aspect-square rounded-lg border-2 flex items-center justify-center text-[8px] font-black uppercase ${fillColor === 'transparent' ? 'border-white bg-slate-800' : 'border-white/10 text-slate-700'}`}>None</button>
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899', '#10b981'].map(c => (
                   <button key={c} onClick={() => setFillColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${fillColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'}`} />
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Text Size</label>
              <input type="range" min="12" max="200" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none" />
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-14 flex flex-col items-center gap-1 group transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-2 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[7px] font-black uppercase tracking-tighter opacity-50 group-hover:opacity-100">{label}</span>
  </button>
);
