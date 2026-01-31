
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

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(15);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);

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
          if (!canvasRef.current || !tempCanvasRef.current) return;
          const w = img.width; const h = img.height;
          canvasRef.current.width = w; canvasRef.current.height = h;
          tempCanvasRef.current.width = w; tempCanvasRef.current.height = h;
          const ctx = canvasRef.current.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          setCanvasImage(img);
          // 初始缩放适配屏幕
          const fitZoom = Math.min((window.innerWidth-500)/w, (window.innerHeight-200)/h, 1);
          setZoom(fitZoom);
          setIsProcessing(false);
        };
      } catch (e) { 
        console.error("Editor init failed", e);
        setIsProcessing(false); 
      }
    };
    init();
  }, [imageUrl]);

  const getPos = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };

  const handleStart = (e: any) => {
    if (currentTool === 'pan' || currentTool === 'select') return;
    setIsDrawing(true);
    const pos = getPos(e);
    setStartPos(pos);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    if (currentTool === 'brush') { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  };

  const handleMove = (e: any) => {
    if (!isDrawing || currentTool === 'pan') return;
    const pos = getPos(e);
    const tCtx = tempCanvasRef.current!.getContext('2d')!;
    tCtx.clearRect(0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);
    tCtx.strokeStyle = strokeColor;
    tCtx.fillStyle = strokeColor;
    tCtx.lineWidth = strokeWidth;
    
    if (currentTool === 'brush') {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (currentTool === 'rect') {
      tCtx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    } else if (currentTool === 'circle') {
      const r = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
      tCtx.beginPath(); tCtx.arc(startPos.x, startPos.y, r, 0, 2 * Math.PI); tCtx.stroke();
    } else if (currentTool === 'line') {
      tCtx.beginPath(); tCtx.moveTo(startPos.x, startPos.y); tCtx.lineTo(pos.x, pos.y); tCtx.stroke();
    } else if (currentTool === 'rect_fill') {
      tCtx.globalAlpha = 0.5;
      tCtx.fillRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    }
  };

  const handleEnd = (e: any) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    const tCtx = tempCanvasRef.current!.getContext('2d')!;
    tCtx.clearRect(0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.globalAlpha = 1.0;

    if (currentTool === 'rect') {
      ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
      ctx.beginPath(); ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI); ctx.stroke();
    } else if (currentTool === 'line') {
      ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (currentTool === 'text') {
      const txt = prompt(uiLang === 'zh' ? "输入文本" : "Enter text");
      if (txt) { ctx.font = `bold ${strokeWidth * 3}px Inter, sans-serif`; ctx.fillText(txt, pos.x, pos.y); }
    } else if (currentTool === 'rect_fill') {
      ctx.fillRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    }
  };

  const pickColor = async () => {
    if (!(window as any).EyeDropper) { alert("Eyedropper not supported."); return; }
    const dropper = new (window as any).EyeDropper();
    try { const res = await dropper.open(); setStrokeColor(res.sRGBHex); } catch (e) {}
  };

  const handleStandardize = () => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.width; const h = canvasRef.current.height;
    
    // 强制 1600x1600 标准算法
    const targetLimit = 1500;
    const scale = Math.min(targetLimit / w, targetLimit / h);
    const dw = w * scale; 
    const dh = h * scale;
    const dx = (1600 - dw) / 2; 
    const dy = (1600 - dh) / 2;
    
    const temp = document.createElement('canvas');
    temp.width = 1600; 
    temp.height = 1600;
    const tCtx = temp.getContext('2d')!;
    
    // 填充白底
    tCtx.fillStyle = '#FFFFFF'; 
    tCtx.fillRect(0, 0, 1600, 1600);
    
    // 绘制内容
    tCtx.drawImage(canvasRef.current, dx, dy, dw, dh);
    
    // 重置主画布
    canvasRef.current.width = 1600; 
    canvasRef.current.height = 1600;
    canvasRef.current.getContext('2d')!.drawImage(temp, 0, 0);
    
    // 重置临时画布
    tempCanvasRef.current!.width = 1600; 
    tempCanvasRef.current!.height = 1600;
    
    // 重置缩放
    setZoom(Math.min((window.innerWidth-500)/1600, (window.innerHeight-200)/1600, 1));
  };

  const handleFinalSave = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return setIsProcessing(false);
      const fd = new FormData();
      fd.append('file', blob, `edit_${Date.now()}.jpg`);
      try {
        const res = await fetch(TARGET_API, { method: 'POST', body: fd });
        const data = await res.json();
        const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
        const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
        if (u) onSave(u);
      } catch (e) {
        alert("Save failed");
      } finally { setIsProcessing(false); }
    }, 'image/jpeg', 0.96);
  };

  const ShapeToolIcon = () => {
    if (currentTool === 'circle') return <Circle size={18} />;
    if (currentTool === 'line') return <Minus size={18} />;
    return <Square size={18} />;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col font-inter">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
          <span className="font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent italic">AI Pro Media Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStandardize} className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/10 transition-all"><Maximize2 size={14}/> 1600px Standardize</button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-4">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Move" />
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={18}/>} label="Brush" />
           
           <div className="relative">
             <SideBtn active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeDropdown(!showShapeDropdown)} icon={<ShapeToolIcon />} label="Shape" />
             {showShapeDropdown && (
               <div className="absolute left-full top-0 ml-2 bg-slate-800 border border-slate-700 rounded-xl p-2 flex flex-col gap-2 shadow-2xl z-50 animate-in slide-in-from-left-2">
                 <button onClick={() => { setCurrentTool('rect'); setShowShapeDropdown(false); }} className="p-3 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"><Square size={16}/></button>
                 <button onClick={() => { setCurrentTool('circle'); setShowShapeDropdown(false); }} className="p-3 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"><Circle size={16}/></button>
                 <button onClick={() => { setCurrentTool('line'); setShowShapeDropdown(false); }} className="p-3 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"><Minus size={16}/></button>
               </div>
             )}
           </div>

           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} label="Text" />
           <SideBtn active={currentTool === 'rect_fill'} onClick={() => setCurrentTool('rect_fill')} icon={<Layers size={18}/>} label="Fill" />
           <SideBtn active={false} onClick={pickColor} icon={<Pipette size={18}/>} label="Pick" />
           
           <div className="w-8 h-px bg-white/10 my-2"></div>
           <button onClick={() => { if(canvasImage && canvasRef.current) { const ctx = canvasRef.current.getContext('2d')!; canvasRef.current.width = canvasImage.width; canvasRef.current.height = canvasImage.height; ctx.drawImage(canvasImage, 0, 0); } }} className="p-3 text-slate-500 hover:text-white" title="Reset"><Undo size={18}/></button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center p-10">
          <div onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} style={{ transform: `scale(${zoom})`, cursor: currentTool === 'pan' ? 'grab' : 'crosshair' }} className="shadow-[0_0_100px_rgba(0,0,0,0.6)] bg-white relative transition-transform duration-75">
             <canvas ref={canvasRef} className="block" />
             <canvas ref={tempCanvasRef} className="absolute inset-0 pointer-events-none" />
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
                Tool Tip: Use 'Fill' to choose a color, then drag a rectangle on the image to mask unwanted areas instantly.
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
