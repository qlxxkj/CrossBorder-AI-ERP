
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Scissors, PaintBucket, Save, Loader2, MousePointer2, 
  Type, Square, Circle, Minus, Palette, Maximize2, 
  ChevronDown, Trash2, Hand, Eraser, Pipette, Check, Square as SquareIcon
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'ai-erase' | 'crop' | 'rect' | 'circle' | 'line' | 'text' | 'select-fill' | 'picker';

interface EditorElement {
  id: string;
  type: Tool;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fillColor: string;
  fillEnabled: boolean;
  strokeWidth: number;
  fontSize: number;
  text?: string;
  points?: { x: number, y: number }[];
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [lastShape, setLastShape] = useState<Tool>('rect');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [fontSize, setFontSize] = useState(64);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [opacity, setOpacity] = useState(1);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  const initImage = useCallback(async (url: string) => {
    if (!url) return;
    setIsProcessing(true);
    try {
      const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}&_t=${Date.now()}`;
      const response = await fetch(proxiedUrl);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImgObj(img);
        setIsProcessing(false);
        const scale = Math.min((window.innerWidth * 0.7) / img.width, (window.innerHeight * 0.7) / img.height, 1);
        setZoom(scale);
      };
      img.src = localUrl;
    } catch (e) {
      alert("Load Error: Image stream blocked.");
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => { initImage(imageUrl); }, [imageUrl, initImage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.min(15, Math.max(0.01, z * delta)));
    };
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !imgObj) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    canvas.width = imgObj.width;
    canvas.height = imgObj.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgObj, 0, 0);
    
    elements.forEach(el => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color; // 默认填充色与线条色一致
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'brush' || el.type === 'ai-erase') {
        if (el.type === 'ai-erase') ctx.globalCompositeOperation = 'destination-out';
        if (el.points && el.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
      } else if (el.type === 'rect' || el.type === 'select-fill' || el.type === 'crop') {
        if (el.type === 'crop') { ctx.setLineDash([10 / zoom, 10 / zoom]); ctx.strokeStyle = '#6366f1'; }
        if (el.fillEnabled || el.type === 'select-fill') {
          ctx.globalAlpha = opacity * 0.6;
          ctx.fillRect(el.x, el.y, el.w, el.h);
          ctx.globalAlpha = opacity;
        }
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'circle') {
        const r = Math.sqrt(el.w**2 + el.h**2);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        if (el.fillEnabled) {
          ctx.globalAlpha = opacity * 0.6;
          ctx.fill();
          ctx.globalAlpha = opacity;
        }
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.w, el.y + el.h);
        ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.fillStyle = el.color;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', el.x, el.y);
      }

      if (el.id === selectedId) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        const h = el.type === 'text' ? el.fontSize : el.h;
        ctx.strokeRect(el.x - 5/zoom, el.y - 5/zoom, (el.w || 50) + 10/zoom, (h || 50) + 10/zoom);
      }
      ctx.restore();
    });
  }, [elements, imgObj, selectedId, zoom, opacity]);

  const getMousePos = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isProcessing || !imgObj) return;
    const pos = getMousePos(e);

    if (currentTool === 'hand') { setIsPanning(true); setLastPanPos({ x: e.clientX, y: e.clientY }); return; }

    if (currentTool === 'select') {
      const hit = [...elements].reverse().find(el => {
        const h = el.type === 'text' ? el.fontSize : el.h;
        const w = el.w || 50;
        const xMin = Math.min(el.x, el.x + w);
        const xMax = Math.max(el.x, el.x + w);
        const yMin = Math.min(el.y, el.y + h);
        const yMax = Math.max(el.y, el.y + h);
        return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
      });
      if (hit) {
        setSelectedId(hit.id);
        setIsDragging(true);
        setDragOffset({ x: pos.x - hit.x, y: pos.y - hit.y });
        // 同步选中元素的属性到侧边栏
        setStrokeColor(hit.color);
        setStrokeWidth(hit.strokeWidth);
        setFontSize(hit.fontSize);
        setFillEnabled(hit.fillEnabled);
      } else {
        setSelectedId(null);
      }
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    const newEl: EditorElement = {
      id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0,
      color: strokeColor, fillColor: strokeColor, fillEnabled: fillEnabled,
      strokeWidth, fontSize,
      points: (currentTool === 'brush' || currentTool === 'ai-erase') ? [pos] : undefined
    };

    if (currentTool === 'text') {
      const txt = prompt(uiLang === 'zh' ? "输入文本" : "Input Text");
      if (!txt) return;
      newEl.text = txt;
      newEl.w = txt.length * fontSize * 0.55;
      newEl.h = fontSize;
      setElements(prev => [...prev, newEl]);
      setSelectedId(id);
    } else {
      setElements(prev => [...prev, newEl]);
      setSelectedId(id);
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (isPanning) {
      setPan(prev => ({ x: prev.x + (e.clientX - lastPanPos.x), y: prev.y + (e.clientY - lastPanPos.y) }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }
    
    if (isDragging && selectedId) {
      setElements(prev => prev.map(el => el.id === selectedId ? { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : el));
      return;
    }

    if (!isDrawing || !selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      if (el.type === 'brush' || el.type === 'ai-erase') return { ...el, points: [...(el.points || []), pos] };
      return { ...el, w: pos.x - el.x, h: pos.y - el.y };
    }));
  };

  const handleCommit = async (standard: boolean) => {
    if (!canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    setSelectedId(null);
    
    // 延迟以确保选中框消失
    setTimeout(async () => {
      const finalCanvas = document.createElement('canvas');
      const fctx = finalCanvas.getContext('2d')!;
      if (standard) {
        finalCanvas.width = 1600; finalCanvas.height = 1600;
        fctx.fillStyle = '#FFFFFF'; fctx.fillRect(0, 0, 1600, 1600);
        const s = Math.min(1500 / canvasRef.current!.width, 1500 / canvasRef.current!.height);
        const dw = canvasRef.current!.width * s, dh = canvasRef.current!.height * s;
        fctx.drawImage(canvasRef.current!, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh);
      } else {
        finalCanvas.width = canvasRef.current!.width;
        finalCanvas.height = canvasRef.current!.height;
        fctx.drawImage(canvasRef.current!, 0, 0);
      }

      finalCanvas.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData();
        fd.append('file', blob, `studio_${Date.now()}.jpg`);
        try {
          // 使用代理上传解决跨域/Referer拦截
          const uploadUrl = `${CORS_PROXY}${encodeURIComponent(TARGET_API)}`;
          const res = await fetch(uploadUrl, { method: 'POST', body: fd });
          if (!res.ok) throw new Error("Upload Blocked");
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : (data.url || data.data?.url);
          const url = typeof rawSrc === 'string' ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url);
          else throw new Error("No URL returned");
        } catch (e) { 
          alert(uiLang === 'zh' ? "云端同步失败，请检查网络或重试" : "Cloud sync failed. Check network."); 
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.98);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col font-inter select-none overflow-hidden text-white">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
          <span className="font-black text-[10px] uppercase tracking-[0.2em] text-indigo-400">AMZBot Pixel Engine v17.0</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleCommit(true)} className="px-5 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-700 transition-all"><Maximize2 size={14}/> 1600 HD</button>
          <button onClick={() => handleCommit(false)} disabled={isProcessing} className="px-10 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-900/40 hover:bg-indigo-700">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync Studio
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-4 shrink-0">
           <SideBtn active={currentTool === 'select'} onClick={() => { setCurrentTool('select'); setSelectedId(null); }} icon={<MousePointer2 size={18}/>} />
           <SideBtn active={currentTool === 'hand'} onClick={() => { setCurrentTool('hand'); setSelectedId(null); }} icon={<Hand size={18}/>} />
           <div className="w-8 h-px bg-white/10 my-1"></div>
           <SideBtn active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelectedId(null); }} icon={<Palette size={18}/>} />
           <SideBtn active={currentTool === 'select-fill'} onClick={() => { setCurrentTool('select-fill'); setSelectedId(null); }} icon={<PaintBucket size={18}/>} />
           <SideBtn active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={18}/>} />
           <div className="relative">
             <SideBtn active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={lastShape === 'rect' ? <SquareIcon size={18}/> : lastShape === 'circle' ? <Circle size={18}/> : <Minus size={18} className="rotate-45" />} />
             {showShapeMenu && (
               <div className="absolute left-full ml-2 top-0 bg-slate-800 border border-white/10 p-2 rounded-xl flex flex-col gap-2 z-[1100] shadow-2xl">
                 <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); setSelectedId(null); }} className={`p-3 rounded-lg hover:bg-white/10 ${currentTool === 'rect' ? 'text-indigo-400' : 'text-slate-400'}`}><SquareIcon size={20}/></button>
                 <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); setSelectedId(null); }} className={`p-3 rounded-lg hover:bg-white/10 ${currentTool === 'circle' ? 'text-indigo-400' : 'text-slate-400'}`}><Circle size={20}/></button>
                 <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); setSelectedId(null); }} className={`p-3 rounded-lg hover:bg-white/10 ${currentTool === 'line' ? 'text-indigo-400' : 'text-slate-400'}`}><Minus size={20} className="rotate-45"/></button>
               </div>
             )}
           </div>
           <SideBtn active={currentTool === 'text'} onClick={() => { setCurrentTool('text'); setSelectedId(null); }} icon={<Type size={18}/>} />
           <SideBtn active={currentTool === 'crop'} onClick={() => { setCurrentTool('crop'); setSelectedId(null); }} icon={<Scissors size={18}/>} />
           <SideBtn active={currentTool === 'ai-erase'} onClick={() => { setCurrentTool('ai-erase'); setSelectedId(null); }} icon={<Eraser size={18}/>} />
           <button onClick={() => { if(selectedId) setElements(prev => prev.filter(x => x.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500 mt-auto" title="Delete Selected"><Trash2 size={20}/></button>
        </div>

        <div ref={containerRef} className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-crosshair">
          {isProcessing && <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[1200] flex flex-col items-center justify-center gap-4">
             <Loader2 className="animate-spin text-indigo-500" size={48}/>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Pixel Buffering...</span>
          </div>}
          
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center', transition: (isPanning || isDrawing || isDragging) ? 'none' : 'transform 0.15s ease-out' }} className="shadow-[0_0_100px_rgba(0,0,0,0.8)] relative bg-white">
            <canvas 
                ref={canvasRef} 
                className={`block ${currentTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : (currentTool === 'select' ? 'cursor-default' : 'cursor-crosshair')}`} 
                onMouseDown={handleMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={() => { setIsDrawing(false); setIsPanning(false); setIsDragging(false); }} 
                onMouseLeave={() => { setIsDrawing(false); setIsPanning(false); setIsDragging(false); }} 
            />
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 flex gap-4 shadow-2xl">
            <span>{Math.round(zoom * 100)}% ZOOM</span>
            <span className="opacity-20">|</span>
            <span>{imgObj?.width}x{imgObj?.height} PX</span>
          </div>
        </div>

        <div className="w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
           <div className="space-y-6">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-white/5 pb-2 block">Drawing Physics</label>
              <div className="space-y-3">
                 <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>Stroke Diameter</span> <span>{strokeWidth}px</span></div>
                 <input type="range" min="1" max="300" value={strokeWidth} onChange={e => { const v = parseInt(e.target.value); setStrokeWidth(v); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, strokeWidth: v} : el)) }} className="w-full accent-indigo-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 uppercase">Fill Shape</span>
                <button 
                  onClick={() => {
                    const next = !fillEnabled;
                    setFillEnabled(next);
                    if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, fillEnabled: next} : el));
                  }} 
                  className={`w-10 h-5 rounded-full transition-all relative ${fillEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${fillEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899', '#10b981'].map(c => (
                  <button key={c} onClick={() => { setStrokeColor(c); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, color: c, fillColor: c} : el)) }} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                ))}
              </div>
           </div>

           <div className="space-y-6">
              <label className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] border-b border-white/5 pb-2 block">Typography</label>
              <div className="space-y-3">
                 <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>Font Size</span> <span>{fontSize}px</span></div>
                 <input type="range" min="12" max="600" value={fontSize} onChange={e => { const v = parseInt(e.target.value); setFontSize(v); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, fontSize: v} : el)) }} className="w-full accent-amber-500" />
              </div>
           </div>

           <div className="space-y-6">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-white/5 pb-2 block">Atmosphere</label>
              <div className="space-y-3">
                 <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>Layer Opacity</span> <span>{Math.round(opacity * 100)}%</span></div>
                 <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{icon}</button>
);
