
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Scissors, PaintBucket, Save, Loader2, MousePointer2, 
  Type, Square, Circle, Minus, Palette, Maximize2, 
  Sparkles, ChevronDown, Trash2, Hand, Eraser
} from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'ai-erase' | 'crop' | 'rect' | 'circle' | 'line' | 'text' | 'select-fill';

interface EditorElement {
  id: string;
  type: Tool;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fillColor: string;
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
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [lastShape, setLastShape] = useState<Tool>('rect');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  
  // 绘图属性
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [fontSize, setFontSize] = useState(64);
  const [opacity, setOpacity] = useState(1);

  // 视口状态
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  // 内部交互状态
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  // 1. 强制加载图片位图
  useEffect(() => {
    if (!imageUrl) return;
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    const proxiedUrl = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
      ? imageUrl 
      : `${CORS_PROXY}${encodeURIComponent(imageUrl)}&_t=${Date.now()}`;
    
    img.onload = () => {
      setImgObj(img);
      setIsProcessing(false);
      // 初始居中及缩放适配
      const scale = Math.min(window.innerWidth * 0.7 / img.width, window.innerHeight * 0.7 / img.height, 1);
      setZoom(scale);
    };
    img.onerror = () => {
      alert("Image Load Failure");
      setIsProcessing(false);
    };
    img.src = proxiedUrl;
  }, [imageUrl]);

  // 2. 物理渲染循环
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
      ctx.fillStyle = el.fillColor;
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
        if (el.type === 'crop') {
           ctx.setLineDash([10 / zoom, 10 / zoom]);
           ctx.strokeStyle = '#6366f1';
        }
        if (el.fillColor !== 'transparent') ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'circle') {
        const r = Math.sqrt(el.w**2 + el.h**2);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        if (el.fillColor !== 'transparent') ctx.fill();
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
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#6366f1';
        ctx.strokeRect(el.x - 2, el.y - 2, el.w + 4, (el.type === 'text' ? el.fontSize : el.h) + 4);
      }
      ctx.restore();
    });
  }, [elements, imgObj, selectedId, zoom, opacity]);

  // 3. 核心坐标转换 (使用 Offset 直接物理映射)
  const getMousePos = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isProcessing || !imgObj) return;
    const pos = getMousePos(e);

    if (currentTool === 'hand') {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (currentTool === 'select') {
      const hit = [...elements].reverse().find(el => {
        const hitZone = 10;
        return pos.x >= el.x - hitZone && pos.x <= el.x + el.w + hitZone && pos.y >= el.y - hitZone && pos.y <= el.y + el.h + hitZone;
      });
      setSelectedId(hit?.id || null);
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    const newEl: EditorElement = {
      id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0,
      color: strokeColor, fillColor: (currentTool === 'select-fill' ? strokeColor : fillColor),
      strokeWidth, fontSize,
      points: (currentTool === 'brush' || currentTool === 'ai-erase') ? [pos] : undefined
    };

    if (currentTool === 'text') {
      const txt = prompt(uiLang === 'zh' ? "文字内容" : "Text");
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
    if (isPanning) {
      setPan(prev => ({ x: prev.x + (e.clientX - lastPanPos.x), y: prev.y + (e.clientY - lastPanPos.y) }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }
    if (!isDrawing || !selectedId) return;
    const pos = getMousePos(e);

    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      if (el.type === 'brush' || el.type === 'ai-erase') {
        return { ...el, points: [...(el.points || []), pos] };
      }
      return { ...el, w: pos.x - el.x, h: pos.y - el.y };
    }));
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsPanning(false);
  };

  const handleCommit = async (standard: boolean) => {
    if (!canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    setSelectedId(null);
    
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
        fd.append('file', blob, `editor_${Date.now()}.jpg`);
        try {
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : (data.url || data.data?.url);
          const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url);
        } catch (e) {
          alert("Save error");
        } finally {
          setIsProcessing(false);
        }
      }, 'image/jpeg', 0.98);
    }, 100);
  };

  const executeCrop = () => {
    const el = elements.find(x => x.id === selectedId && x.type === 'crop');
    if (!el || !canvasRef.current) return;
    setIsProcessing(true);
    const temp = document.createElement('canvas');
    temp.width = Math.abs(el.w); temp.height = Math.abs(el.h);
    const tctx = temp.getContext('2d')!;
    const sx = el.w > 0 ? el.x : el.x + el.w;
    const sy = el.h > 0 ? el.y : el.y + el.h;
    tctx.drawImage(canvasRef.current, sx, sy, temp.width, temp.height, 0, 0, temp.width, temp.height);
    const img = new Image();
    img.onload = () => { setImgObj(img); setElements([]); setSelectedId(null); setIsProcessing(false); };
    img.src = temp.toDataURL('image/jpeg');
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col font-inter select-none overflow-hidden">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
          <span className="font-black text-xs uppercase tracking-widest text-indigo-400">AMZBot AI Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleCommit(true)} className="px-5 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Maximize2 size={14}/> 1600 Std</button>
          <button onClick={() => handleCommit(false)} disabled={isProcessing} className="px-10 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-4">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={18}/>} />
           <div className="w-8 h-px bg-white/10"></div>
           <SideBtn active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelectedId(null); }} icon={<Palette size={18}/>} />
           <div className="relative">
             <SideBtn active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={lastShape === 'rect' ? <Square size={18}/> : lastShape === 'circle' ? <Circle size={18}/> : <Minus size={18} className="rotate-45" />} />
             {showShapeMenu && (
               <div className="absolute left-full ml-2 top-0 bg-slate-800 border border-white/10 p-2 rounded-xl flex flex-col gap-2 z-[1100]">
                 <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-indigo-400"><Square size={18}/></button>
                 <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-indigo-400"><Circle size={18}/></button>
                 <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-indigo-400"><Minus size={18} className="rotate-45"/></button>
               </div>
             )}
           </div>
           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} />
           <SideBtn active={currentTool === 'crop'} onClick={() => setCurrentTool('crop')} icon={<Scissors size={18}/>} />
           <SideBtn active={currentTool === 'ai-erase'} onClick={() => setCurrentTool('ai-erase')} icon={<Eraser size={18}/>} />
           <button onClick={() => { if(selectedId) setElements(prev => prev.filter(x => x.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500 mt-auto"><Trash2 size={18}/></button>
        </div>

        <div className="flex-1 bg-slate-950 relative overflow-hidden" 
             onMouseDown={handleMouseDown} 
             onMouseMove={handleMouseMove} 
             onMouseUp={handleMouseUp} 
             onMouseLeave={handleMouseUp}>
          {isProcessing && <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[1200] flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48}/></div>}
          
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl">
            <canvas ref={canvasRef} className="bg-white block cursor-crosshair" />
            {currentTool === 'crop' && selectedId && (
              <button onClick={executeCrop} className="absolute -top-12 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full font-black text-[10px] uppercase shadow-xl animate-bounce">Execute Crop</button>
            )}
          </div>
        </div>

        <div className="w-64 bg-slate-900 border-l border-white/5 p-6 text-white space-y-8">
           <PropGroup label="Size">
              <input type="range" min="1" max="200" value={currentTool === 'text' ? fontSize : strokeWidth} onChange={e => { const v = parseInt(e.target.value); if(currentTool === 'text') setFontSize(v); else setStrokeWidth(v); }} className="w-full accent-indigo-500" />
           </PropGroup>
           <PropGroup label="Colors">
              <div className="grid grid-cols-5 gap-2">
                {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899', '#10b981'].map(c => (
                  <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`w-8 h-8 rounded-lg border-2 ${strokeColor === c ? 'border-white' : 'border-transparent opacity-60'}`} />
                ))}
              </div>
           </PropGroup>
           <PropGroup label="Opacity">
              <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
           </PropGroup>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{icon}</button>
);

const PropGroup = ({ label, children }: any) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);
