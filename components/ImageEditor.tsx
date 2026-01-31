
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, Save, Undo, Loader2, MousePointer2, 
  Palette, ZoomIn, ZoomOut, Move, Maximize2, Type
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'brush' | 'pan';

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(5);

  useEffect(() => {
    const init = async () => {
      setIsProcessing(true);
      try {
        const proxied = imageUrl.startsWith('http') ? `${CORS_PROXY}${encodeURIComponent(imageUrl)}` : imageUrl;
        const res = await fetch(proxied);
        const blob = await res.blob();
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
          if (!canvasRef.current) return;
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
          canvasRef.current.getContext('2d')!.drawImage(img, 0, 0);
          setZoom(Math.min((window.innerWidth-300)/img.width, (window.innerHeight-200)/img.height, 1));
          setIsProcessing(false);
        };
      } catch (e) { setIsProcessing(false); }
    };
    init();
  }, [imageUrl]);

  const handleStart = (e: any) => {
    if (currentTool !== 'brush') return;
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d')!;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleMove = (e: any) => {
    if (!isDrawing || currentTool !== 'brush') return;
    const ctx = canvasRef.current?.getContext('2d')!;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEnd = () => setIsDrawing(false);

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
        else throw new Error();
      } catch (e) { alert("Save Error"); }
      finally { setIsProcessing(false); }
    }, 'image/jpeg', 0.92);
  };

  const handleStandardize = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const oldW = canvas.width; const oldH = canvas.height;
    const scale = Math.min(1500 / oldW, 1500 / oldH);
    const dW = oldW * scale; const dH = oldH * scale;
    const oX = (1600 - dW) / 2; const oY = (1600 - dH) / 2;
    const temp = document.createElement('canvas');
    temp.width = 1600; temp.height = 1600;
    const tCtx = temp.getContext('2d')!;
    tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0,0,1600,1600);
    tCtx.drawImage(canvas, oX, oY, dW, dH);
    canvas.width = 1600; canvas.height = 1600;
    canvas.getContext('2d')!.drawImage(temp, 0, 0);
    setZoom(Math.min((window.innerWidth-300)/1600, (window.innerHeight-200)/1600, 1));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col font-inter">
      <div className="h-16 bg-slate-950 border-b border-white/10 px-6 flex items-center justify-between text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
          <span className="font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">AI Media Lab</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStandardize} className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/10 transition-all"><Maximize2 size={14}/> 1600px Standard</button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-900/40 disabled:opacity-50 transition-all">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Apply & Sync
          </button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-slate-900 flex items-center justify-center p-12">
        <div onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd} style={{ transform: `scale(${zoom})` }} className="shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white relative transition-transform duration-75">
           <canvas ref={canvasRef} className="block" />
        </div>
      </div>
      <div className="h-20 bg-slate-950 border-t border-white/5 px-8 flex items-center gap-6">
        <button onClick={() => setCurrentTool('select')} className={`flex flex-col items-center gap-1 ${currentTool === 'select' ? 'text-indigo-400' : 'text-slate-500'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentTool === 'select' ? 'bg-indigo-600/20 ring-1 ring-indigo-500' : 'bg-white/5'}`}><MousePointer2 size={18}/></div>
          <span className="text-[8px] font-black uppercase">Select</span>
        </button>
        <button onClick={() => setCurrentTool('brush')} className={`flex flex-col items-center gap-1 ${currentTool === 'brush' ? 'text-indigo-400' : 'text-slate-500'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentTool === 'brush' ? 'bg-indigo-600/20 ring-1 ring-indigo-500' : 'bg-white/5'}`}><Palette size={18}/></div>
          <span className="text-[8px] font-black uppercase">Draw</span>
        </button>
        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Brush Settings</span>
          <div className="flex gap-4">
             <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer" />
             <input type="range" min="1" max="50" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-32 accent-indigo-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
