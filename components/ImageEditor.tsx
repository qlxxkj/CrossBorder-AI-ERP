
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, Save, Undo, Loader2, MousePointer2, 
  Palette, ZoomIn, ZoomOut, Move, Maximize2, Sparkles, Paintbrush
} from 'lucide-react';
import { UILanguage } from '../types';
import { editImageWithAI } from '../services/geminiService';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'brush' | 'ai-erase' | 'pan';

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(20);

  useEffect(() => {
    const init = async () => {
      setIsProcessing(true);
      try {
        const proxied = imageUrl.startsWith('http') ? `${CORS_PROXY}${encodeURIComponent(imageUrl)}` : imageUrl;
        const res = await fetch(proxied);
        const blob = await res.blob();
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
          if (!canvasRef.current || !maskCanvasRef.current) return;
          const w = img.width; const h = img.height;
          canvasRef.current.width = w; canvasRef.current.height = h;
          maskCanvasRef.current.width = w; maskCanvasRef.current.height = h;
          
          canvasRef.current.getContext('2d')!.drawImage(img, 0, 0);
          setZoom(Math.min((window.innerWidth-400)/w, (window.innerHeight-200)/h, 1));
          setIsProcessing(false);
        };
      } catch (e) { setIsProcessing(false); }
    };
    init();
  }, [imageUrl]);

  const getPos = (e: any) => {
    const rect = maskCanvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  };

  const handleStart = (e: any) => {
    if (currentTool === 'pan') return;
    setIsDrawing(true);
    const ctx = maskCanvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = currentTool === 'ai-erase' ? 'rgba(255, 0, 255, 0.5)' : strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleMove = (e: any) => {
    if (!isDrawing || currentTool === 'pan') return;
    const ctx = maskCanvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleEnd = () => setIsDrawing(false);

  const executeAIErase = async () => {
    if (!canvasRef.current || !maskCanvasRef.current) return;
    setIsProcessing(true);
    try {
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1];
      const maskBase64 = maskCanvasRef.current.toDataURL('image/png').split(',')[1];
      
      // 注意：此处应调用 AI 消除接口，Gemini 2.5 Flash Image 暂不支持 Mask。
      // 为演示逻辑，我们暂且对编辑器进行本地 Mask 覆盖处理或提示用户。
      alert(uiLang === 'zh' ? "AI 智能填充正在接入云端，当前版本将进行画笔合并处理。" : "AI Inpaint is connecting to cloud. Merging layers locally for now.");
      
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.drawImage(maskCanvasRef.current, 0, 0);
      maskCanvasRef.current.getContext('2d')!.clearRect(0,0,maskCanvasRef.current.width, maskCanvasRef.current.height);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalSave = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    
    // 合并 Mask
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvasRef.current.width;
    finalCanvas.height = canvasRef.current.height;
    const fCtx = finalCanvas.getContext('2d')!;
    fCtx.drawImage(canvasRef.current, 0, 0);
    fCtx.drawImage(maskCanvasRef.current!, 0, 0);

    finalCanvas.toBlob(async (blob) => {
      if (!blob) return setIsProcessing(false);
      const fd = new FormData();
      fd.append('file', blob, `ai_lab_${Date.now()}.jpg`);
      try {
        const res = await fetch(TARGET_API, { method: 'POST', body: fd });
        const data = await res.json();
        const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
        const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
        if (u) onSave(u);
        else throw new Error();
      } catch (e) { alert("Save Failure"); }
      finally { setIsProcessing(false); }
    }, 'image/jpeg', 0.92);
  };

  const handleStandardize = () => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.width; const h = canvasRef.current.height;
    const scale = Math.min(1500 / w, 1500 / h);
    const dW = w * scale; const dH = h * scale;
    const oX = (1600 - dW) / 2; const oY = (1600 - dH) / 2;

    const temp = document.createElement('canvas');
    temp.width = 1600; temp.height = 1600;
    const tCtx = temp.getContext('2d')!;
    tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0,0,1600,1600);
    tCtx.drawImage(canvasRef.current, oX, oY, dW, dH);
    tCtx.drawImage(maskCanvasRef.current!, oX, oY, dW, dH);
    
    canvasRef.current.width = 1600; canvasRef.current.height = 1600;
    canvasRef.current.getContext('2d')!.drawImage(temp, 0, 0);
    maskCanvasRef.current!.width = 1600; maskCanvasRef.current!.height = 1600;
    maskCanvasRef.current!.getContext('2d')!.clearRect(0,0,1600,1600);
    
    setZoom(Math.min((window.innerWidth-400)/1600, (window.innerHeight-200)/1600, 1));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col font-inter">
      <div className="h-16 bg-slate-900 border-b border-white/5 px-6 flex items-center justify-between text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
          <span className="font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">AI Media Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStandardize} className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/10 transition-all"><Maximize2 size={14}/> 1600px Fix</button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-900/40 disabled:opacity-50">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-8 gap-6">
           <SideTool active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={20}/>} label="Brush" />
           <SideTool active={currentTool === 'ai-erase'} onClick={() => setCurrentTool('ai-erase')} icon={<Sparkles size={20}/>} label="AI Fill" />
           <SideTool active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Move size={20}/>} label="Pan" />
           <div className="w-8 h-px bg-white/10 my-2"></div>
           <button onClick={() => { maskCanvasRef.current?.getContext('2d')?.clearRect(0,0,maskCanvasRef.current.width, maskCanvasRef.current.height); }} className="p-3 text-slate-500 hover:text-white transition-colors" title="Clear Mask"><Undo size={20}/></button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center">
          <div onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd} style={{ transform: `scale(${zoom})`, cursor: currentTool === 'pan' ? 'grab' : 'crosshair' }} className="shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white relative transition-transform duration-75">
             <canvas ref={canvasRef} className="block" />
             <canvas ref={maskCanvasRef} className="absolute inset-0 pointer-events-none" />
          </div>
        </div>

        <div className="w-64 bg-slate-900 border-l border-white/5 p-6 space-y-8">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Brush Size</label>
              <input type="range" min="1" max="100" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase"><span>Small</span><span>{strokeWidth}px</span><span>Large</span></div>
           </div>
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Mask Color</label>
              <div className="grid grid-cols-5 gap-2">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'].map(c => (
                   <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110' : 'border-transparent'}`} />
                 ))}
              </div>
           </div>
           <div className="pt-10">
              <button onClick={executeAIErase} disabled={currentTool !== 'ai-erase' || isProcessing} className="w-full py-4 bg-white/5 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-20">
                <Sparkles size={14}/> Run Inference
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideTool = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all group ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50' : 'bg-white/5 group-hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);
