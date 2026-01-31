
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

interface EditorState {
  canvasData: string;
  objects: EditorObject[];
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<{x1:number, y1:number, x2:number, y2:number} | null>(null);
  const [history, setHistory] = useState<EditorState[]>([]);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(5);

  useEffect(() => {
    const init = async () => {
      setIsProcessing(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `${CORS_PROXY}${encodeURIComponent(imageUrl)}`;
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        setHistory([{ canvasData: canvas.toDataURL(), objects: [] }]);
        setIsProcessing(false);
        const scale = Math.min((window.innerWidth - 300) / img.width, (window.innerHeight - 200) / img.height, 1);
        setZoom(scale);
      };
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
    
    // 1. 原始图片
    fCtx.drawImage(canvasRef.current, 0, 0);
    
    // 2. 绘制所有对象
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
      fd.append('file', blob, `editor_${Date.now()}.jpg`);
      try {
        const res = await fetch(TARGET_API, { method: 'POST', body: fd });
        const data = await res.json();
        const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
        const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
        if (u) onSave(u);
        else throw new Error();
      } catch (e) { alert("Save Failed"); }
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
    tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0,0,1600,1600);
    tCtx.drawImage(canvasRef.current, oX, oY, dW, dH);
    
    canvasRef.current.width = 1600; canvasRef.current.height = 1600;
    canvasRef.current.getContext('2d')!.drawImage(temp, 0, 0);
    
    const migrated = objects.map(o => ({ ...o, x: o.x * scale + oX, y: o.y * scale + oY, width: o.width * scale, height: o.height * scale }));
    setObjects(migrated);
    setZoom(Math.min((window.innerWidth-300)/1600, (window.innerHeight-200)/1600, 1));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-800 flex flex-col">
      <div className="h-16 bg-slate-900 border-b border-slate-700 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full"><X size={20}/></button>
          <span className="font-black text-xs uppercase tracking-widest">AI Media Lab</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStandardize} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"><Maximize2 size={14}/> 1600px Standard</button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl disabled:opacity-50">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Apply & Sync
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-800/50 flex items-center justify-center p-10">
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} className="shadow-2xl bg-white relative transition-transform duration-75">
           <canvas ref={canvasRef} className="block" />
           <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${canvasRef.current?.width || 0} ${canvasRef.current?.height || 0}`}>
             {objects.map(obj => (
               <g key={obj.id} transform={`rotate(${obj.rotation*180/Math.PI} ${obj.x+obj.width/2} ${obj.y+obj.height/2})`}>
                 {obj.type==='rect' && <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                 {obj.type==='circle' && <ellipse cx={obj.x+obj.width/2} cy={obj.y+obj.height/2} rx={obj.width/2} ry={obj.height/2} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                 {obj.type==='text' && <text x={obj.x} y={obj.y+obj.height} fill={obj.fill} className="font-black text-sm">{obj.text}</text>}
               </g>
             ))}
           </svg>
        </div>
      </div>
      <div className="h-20 bg-slate-900 border-t border-slate-700 px-6 flex items-center gap-4">
        <button onClick={() => setCurrentTool('select')} className={`p-3 rounded-xl transition-all ${currentTool === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><MousePointer2 size={18}/></button>
        <button onClick={() => setCurrentTool('brush')} className={`p-3 rounded-xl transition-all ${currentTool === 'brush' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Palette size={18}/></button>
        <button onClick={() => setCurrentTool('ai-erase')} className={`p-3 rounded-xl transition-all ${currentTool === 'ai-erase' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Eraser size={18}/></button>
        <button onClick={() => setCurrentTool('pan')} className={`p-3 rounded-xl transition-all ${currentTool === 'pan' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Move size={18}/></button>
      </div>
    </div>
  );
};
