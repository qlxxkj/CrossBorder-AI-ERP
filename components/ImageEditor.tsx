
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Loader2, MousePointer2, Type, Square, Circle, Minus, 
  Palette, ZoomIn, ZoomOut, Move, Maximize2, Sparkles
} from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'brush' | 'ai-erase' | 'crop' | 'rect' | 'circle' | 'line' | 'text' | 'pan';

interface EditorObject {
  id: string;
  type: 'rect' | 'circle' | 'line' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; 
  stroke: string;
  fill: string;
  strokeWidth: number;
  fontSize?: number; 
  opacity: number;
  text?: string;
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [objects, setObjects] = useState<EditorObject[]>([]);
  
  useEffect(() => {
    const init = async () => {
      setIsProcessing(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl.startsWith('http') ? `${CORS_PROXY}${encodeURIComponent(imageUrl)}` : imageUrl;
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        setIsProcessing(false);
        const scale = Math.min((window.innerWidth - 300) / img.width, (window.innerHeight - 200) / img.height, 1);
        setZoom(scale);
      };
      img.onerror = () => setIsProcessing(false);
    };
    init();
  }, [imageUrl]);

  const handleFinalSave = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvasRef.current.width;
    finalCanvas.height = canvasRef.current.height;
    const fCtx = finalCanvas.getContext('2d')!;
    
    fCtx.drawImage(canvasRef.current, 0, 0);
    
    objects.forEach(obj => {
      fCtx.save();
      fCtx.globalAlpha = obj.opacity;
      const cX = obj.x + obj.width / 2;
      const cY = obj.y + obj.height / 2;
      fCtx.translate(cX, cY); fCtx.rotate(obj.rotation); fCtx.translate(-cX, -cY);
      fCtx.strokeStyle = obj.stroke; fCtx.fillStyle = obj.fill; fCtx.lineWidth = obj.strokeWidth;
      if (obj.type === 'rect') { 
        if (obj.fill !== 'transparent') fCtx.fillRect(obj.x, obj.y, obj.width, obj.height);
        if (obj.stroke !== 'transparent') fCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      } else if (obj.type === 'circle') {
        fCtx.beginPath(); fCtx.ellipse(cX, cY, obj.width/2, obj.height/2, 0, 0, Math.PI*2);
        if (obj.fill !== 'transparent') fCtx.fill();
        if (obj.stroke !== 'transparent') fCtx.stroke();
      } else if (obj.type === 'text') {
        fCtx.font = `bold ${obj.fontSize}px Inter`;
        fCtx.fillText(obj.text || "", obj.x, obj.y + obj.height);
      }
      fCtx.restore();
    });

    finalCanvas.toBlob(async (blob) => {
      if (!blob) return setIsProcessing(false);
      const fd = new FormData();
      fd.append('file', blob, `ai_edit_${Date.now()}.jpg`);
      try {
        const res = await fetch(TARGET_API, { method: 'POST', body: fd });
        const data = await res.json();
        const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
        const finalUrl = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
        if (finalUrl) onSave(finalUrl);
        else throw new Error();
      } catch (e) { alert("Sync Error"); }
      finally { setIsProcessing(false); }
    }, 'image/jpeg', 0.92);
  };

  const handleStandardize = () => {
    if (!canvasRef.current) return;
    const oldW = canvasRef.current.width; const oldH = canvasRef.current.height;
    const scale = Math.min(1500 / oldW, 1500 / oldH);
    const dW = oldW * scale; const dH = oldH * scale;
    const oX = (1600 - dW) / 2; const oY = (1600 - dH) / 2;

    const temp = document.createElement('canvas');
    temp.width = 1600; temp.height = 1600;
    const tCtx = temp.getContext('2d')!;
    tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0, 0, 1600, 1600);
    tCtx.drawImage(canvasRef.current, oX, oY, dW, dH);
    
    canvasRef.current.width = 1600; canvasRef.current.height = 1600;
    canvasRef.current.getContext('2d')!.drawImage(temp, 0, 0);
    
    const migrated = objects.map(o => ({ ...o, x: o.x * scale + oX, y: o.y * scale + oY, width: o.width * scale, height: o.height * scale }));
    setObjects(migrated);
    setZoom(Math.min((window.innerWidth - 300) / 1600, (window.innerHeight - 200) / 1600, 1));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col font-inter">
      <div className="h-16 bg-slate-950 border-b border-white/10 px-6 flex items-center justify-between text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
          <span className="font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">AI Vision Lab</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStandardize} className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/10 transition-all"><Maximize2 size={14}/> 1600px Standard</button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl shadow-indigo-900/40 disabled:opacity-50 transition-all">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Apply & Sync
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-900 flex items-center justify-center p-12">
        {isProcessing && !canvasRef.current && <div className="flex flex-col items-center gap-3"><Loader2 className="animate-spin text-indigo-500" size={48} /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inference Engines Loading...</p></div>}
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} className="shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white relative transition-transform duration-100 ease-out">
           <canvas ref={canvasRef} className="block" />
        </div>
      </div>
      <div className="h-20 bg-slate-950 border-t border-white/5 px-8 flex items-center gap-6">
        <ToolBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Select" />
        <ToolBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Palette size={18}/>} label="Draw" />
        <ToolBtn active={currentTool === 'ai-erase'} onClick={() => setCurrentTool('ai-erase')} icon={<Eraser size={18}/>} label="AI Inpaint" />
        <ToolBtn active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Move size={18}/>} label="Pan" />
      </div>
    </div>
  );
};

const ToolBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 group ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'} transition-all`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-indigo-600/20 ring-1 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter opacity-60 group-hover:opacity-100">{label}</span>
  </button>
);
