
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Scissors, PaintBucket, Save, Loader2, MousePointer2, 
  Type, Square, Circle, Minus, Palette, Maximize2, 
  Trash2, Hand, Eraser, Check, Square as SquareIcon
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'select-fill';

interface EditorElement {
  id: string;
  type: Tool;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fillEnabled: boolean;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
  text?: string;
  points?: { x: number, y: number }[];
}

const IMAGE_PROXY = 'https://images.weserv.nl/?url=';
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
  const [fillEnabled, setFillEnabled] = useState(true);
  const [layerOpacity, setLayerOpacity] = useState(1); 

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  const initImage = useCallback(async (url: string) => {
    if (!url) return;
    setIsProcessing(true);
    const cleanUrl = url.split('?')[0];
    const proxiedUrl = `${IMAGE_PROXY}${encodeURIComponent(cleanUrl)}`;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImgObj(img);
      setIsProcessing(false);
      const scale = Math.min((window.innerWidth * 0.6) / img.width, (window.innerHeight * 0.6) / img.height, 1);
      setZoom(scale);
    };
    img.onerror = () => {
      const retryImg = new Image();
      retryImg.crossOrigin = "anonymous";
      retryImg.onload = () => { setImgObj(retryImg); setIsProcessing(false); };
      retryImg.onerror = () => { setIsProcessing(false); alert("Pixel Engine: Image Load Error"); };
      retryImg.src = cleanUrl;
    };
    img.src = proxiedUrl;
  }, []);

  useEffect(() => { initImage(imageUrl); }, [imageUrl, initImage]);

  const renderToCtx = (ctx: CanvasRenderingContext2D, els: EditorElement[], targetImg: HTMLImageElement) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(targetImg, 0, 0);
    
    els.forEach(el => {
      ctx.save();
      ctx.globalAlpha = el.opacity;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'brush') {
        if (el.points && el.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
      } else if (el.type === 'rect' || el.type === 'select-fill') {
        if (el.fillEnabled) {
          ctx.fillRect(el.x, el.y, el.w, el.h);
        }
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'circle') {
        const r = Math.sqrt(el.w**2 + el.h**2);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        if (el.fillEnabled) ctx.fill();
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.w, el.y + el.h);
        ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', el.x, el.y);
      }

      if (el.id === selectedId && ctx.canvas.id === 'editor-canvas') {
        ctx.globalAlpha = 1;
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        const pad = 10 / zoom;
        const boxH = el.type === 'text' ? el.fontSize : (el.type === 'brush' ? (el.h || 50) : Math.abs(el.h));
        const boxW = el.type === 'brush' ? (el.w || 50) : Math.abs(el.w);
        ctx.strokeRect(el.x - pad, el.y - pad, (boxW || 50) + pad * 2, (boxH || 50) + pad * 2);
      }
      ctx.restore();
    });
  };

  useEffect(() => {
    if (!canvasRef.current || !imgObj) return;
    canvasRef.current.width = imgObj.width;
    canvasRef.current.height = imgObj.height;
    canvasRef.current.id = 'editor-canvas';
    const ctx = canvasRef.current.getContext('2d')!;
    renderToCtx(ctx, elements, imgObj);
  }, [elements, imgObj, selectedId, zoom]);

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
    setLastMousePos(pos);

    if (currentTool === 'hand') { 
      setIsPanning(true); return; 
    }

    if (currentTool === 'select') {
      const hit = [...elements].reverse().find(el => {
        const boxH = el.type === 'text' ? el.fontSize : (Math.abs(el.h) || 50);
        const boxW = Math.abs(el.w) || 50;
        const minX = Math.min(el.x, el.x + (el.w || 0));
        const minY = Math.min(el.y, el.y + (el.h || 0));
        return pos.x >= minX - 20 && pos.x <= minX + boxW + 20 && pos.y >= minY - 20 && pos.y <= minY + boxH + 20;
      });
      if (hit) {
        setSelectedId(hit.id);
        setIsDragging(true);
        setStrokeColor(hit.color);
        setStrokeWidth(hit.strokeWidth);
        setFillEnabled(hit.fillEnabled);
        setLayerOpacity(hit.opacity);
      } else {
        setSelectedId(null);
      }
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    const newEl: EditorElement = {
      id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0,
      color: strokeColor, fillEnabled, strokeWidth, fontSize, opacity: layerOpacity,
      points: currentTool === 'brush' ? [pos] : undefined
    };

    if (currentTool === 'text') {
      const txt = prompt(uiLang === 'zh' ? "输入文字" : "Enter Text");
      if (!txt) return;
      newEl.text = txt;
      newEl.w = txt.length * fontSize * 0.6;
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
      setPan(prev => ({ x: prev.x + (pos.x - lastMousePos.x) * zoom, y: prev.y + (pos.y - lastMousePos.y) * zoom }));
      setLastMousePos(pos);
      return;
    }
    
    if (isDragging && selectedId) {
      const dx = pos.x - lastMousePos.x;
      const dy = pos.y - lastMousePos.y;
      setElements(prev => prev.map(el => {
        if (el.id !== selectedId) return el;
        if (el.type === 'brush' && el.points) {
           return { ...el, x: el.x + dx, y: el.y + dy, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      }));
      setLastMousePos(pos);
      return;
    }

    if (!isDrawing || !selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      if (el.type === 'brush') return { ...el, points: [...(el.points || []), pos], w: Math.max(el.w, pos.x - el.x), h: Math.max(el.h, pos.y - el.y) };
      return { ...el, w: pos.x - el.x, h: pos.y - el.y };
    }));
    setLastMousePos(pos);
  };

  const handleCommit = async (standard: boolean) => {
    if (!imgObj || isProcessing) return;
    setIsProcessing(true);
    setSelectedId(null);

    setTimeout(() => {
      const finalCanvas = document.createElement('canvas');
      const fctx = finalCanvas.getContext('2d')!;
      
      if (standard) {
        finalCanvas.width = 1600; finalCanvas.height = 1600;
        fctx.fillStyle = '#FFFFFF'; fctx.fillRect(0, 0, 1600, 1600);
        const s = Math.min(1500 / imgObj.width, 1500 / imgObj.height);
        const dw = imgObj.width * s, dh = imgObj.height * s;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgObj.width; tempCanvas.height = imgObj.height;
        renderToCtx(tempCanvas.getContext('2d')!, elements, imgObj);
        fctx.drawImage(tempCanvas, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh);
      } else {
        finalCanvas.width = imgObj.width;
        finalCanvas.height = imgObj.height;
        renderToCtx(fctx, elements, imgObj);
      }

      finalCanvas.toBlob(async (blob) => {
        if (!blob) { setIsProcessing(false); return; }
        const fd = new FormData();
        fd.append('file', blob, `amzbot_studio_${Date.now()}.jpg`);
        try {
          // 移除代理直连上传，解决 403 问题
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) ? data[0]?.src : (data.url || data.data?.url || data.src);
          const url = typeof rawSrc === 'string' ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url + `?studio=${Date.now()}`);
          else throw new Error("Format error");
        } catch (e) {
          alert(uiLang === 'zh' ? "同步失败：云端图床连接异常，请稍后再试" : "Sync Error: Server unreachable.");
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.95);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col font-inter select-none overflow-hidden text-white">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between shadow-2xl shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
          <span className="font-black text-[10px] uppercase tracking-[0.2em] text-indigo-400">AMZBot Pixel Studio v18.8</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleCommit(true)} className="px-5 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-700 transition-all border border-white/5"><Maximize2 size={14}/> 1600 HD</button>
          <button onClick={() => handleCommit(false)} disabled={isProcessing} className="px-10 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-900/40 hover:bg-indigo-700 active:scale-95 transition-all">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>} Sync & Close
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-4 shrink-0 z-[1100]">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={18}/>} />
           <div className="w-8 h-px bg-white/10 my-1"></div>
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Palette size={18}/>} />
           <SideBtn active={currentTool === 'select-fill'} onClick={() => setCurrentTool('select-fill')} icon={<PaintBucket size={18}/>} />
           <div className="relative">
             <SideBtn active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={lastShape === 'rect' ? <SquareIcon size={18}/> : lastShape === 'circle' ? <Circle size={18}/> : <Minus size={18} className="rotate-45" />} />
             {showShapeMenu && (
               <div className="absolute left-full ml-4 top-0 bg-slate-800 border border-white/10 p-2 rounded-2xl flex flex-col gap-2 z-[2000] shadow-2xl">
                 <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); }} className="p-4 rounded-xl hover:bg-white/10 text-slate-400"><SquareIcon size={24}/></button>
                 <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); }} className="p-4 rounded-xl hover:bg-white/10 text-slate-400"><Circle size={24}/></button>
                 <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); }} className="p-4 rounded-xl hover:bg-white/10 text-slate-400"><Minus size={24} className="rotate-45"/></button>
               </div>
             )}
           </div>
           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} />
           <div className="mt-auto flex flex-col gap-4">
             <button 
                onClick={() => { if(selectedId) { setElements(prev => prev.filter(x => x.id !== selectedId)); setSelectedId(null); } }} 
                className={`p-4 rounded-xl transition-all ${selectedId ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' : 'text-slate-700 pointer-events-none'}`} 
                title="Delete Selected"
             >
                <Trash2 size={20}/>
             </button>
           </div>
        </div>

        <div ref={containerRef} className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center">
          {isProcessing && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[1200] flex flex-col items-center justify-center gap-4">
             <Loader2 className="animate-spin text-indigo-500" size={48}/>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 animate-pulse">Rendering Pixels...</p>
          </div>}
          
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: (isPanning || isDrawing || isDragging) ? 'none' : 'transform 0.1s ease-out' }} className="shadow-2xl relative bg-white">
            <canvas 
                ref={canvasRef} 
                className={`block ${currentTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : (currentTool === 'select' ? 'cursor-default' : 'cursor-crosshair')}`} 
                onMouseDown={handleMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={() => { setIsDrawing(false); setIsPanning(false); setIsDragging(false); }} 
                onMouseLeave={() => { setIsDrawing(false); setIsPanning(false); setIsDragging(false); }} 
            />
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 flex gap-4 shadow-2xl pointer-events-none">
            <span>{Math.round(zoom * 100)}% ZOOM</span>
            <span className="opacity-20">|</span>
            <span>{imgObj?.width}x{imgObj?.height} PX</span>
          </div>
        </div>

        <div className="w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
           <div className="space-y-6">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-white/5 pb-2 block">Drawing Physics</label>
              <div className="space-y-3">
                 <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>Size</span> <span>{strokeWidth}px</span></div>
                 <input type="range" min="1" max="200" value={strokeWidth} onChange={e => { const v = parseInt(e.target.value); setStrokeWidth(v); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, strokeWidth: v} : el)) }} className="w-full accent-indigo-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 uppercase">Fill Shape</span>
                <button 
                  onClick={() => {
                    const next = !fillEnabled; setFillEnabled(next);
                    if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, fillEnabled: next} : el));
                  }} 
                  className={`w-10 h-5 rounded-full transition-all relative ${fillEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${fillEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899', '#10b981'].map(c => (
                  <button key={c} onClick={() => { setStrokeColor(c); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, color: c} : el)) }} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                ))}
              </div>
           </div>

           <div className="space-y-6">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-white/5 pb-2 block">Atmosphere</label>
              <div className="space-y-3">
                 <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>Opacity</span> <span>{Math.round(layerOpacity * 100)}%</span></div>
                 <input type="range" min="0.1" max="1" step="0.01" value={layerOpacity} onChange={e => { const v = parseFloat(e.target.value); setLayerOpacity(v); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, opacity: v} : el)) }} className="w-full accent-emerald-500" />
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
