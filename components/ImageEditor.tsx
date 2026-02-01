
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Scissors, PaintBucket, Save, Loader2, MousePointer2, 
  Type, Square, Circle, Minus, Palette, Maximize2, 
  Sparkles, ChevronDown, Trash2, Hand
} from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';
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
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [lastShape, setLastShape] = useState<Tool>('rect');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  
  // 实时属性
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [fontSize, setFontSize] = useState(64);
  const [opacity, setOpacity] = useState(1);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);

  // 1. 初始化底图：修复白屏问题的物理加载逻辑
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
          img.onload = async () => {
            try {
              // 关键修复：强制浏览器解码图像位图，确保绘制时底图就绪
              if ('decode' in img) await img.decode();
              resolve(img);
            } catch (e) { reject(e); }
          };
          img.onerror = (e) => reject(new Error("Image Load Failed"));
          img.src = proxiedUrl;
        });
        
        setCanvasImage(img);
        if (containerRef.current) {
          const scale = Math.min((containerRef.current.clientWidth - 100) / img.width, (containerRef.current.clientHeight - 100) / img.height, 1);
          setZoom(scale);
        }
      } catch (e) {
        console.error("Editor Critical Loading Error:", e);
      } finally {
        setIsProcessing(false);
      }
    };
    loadImage();
  }, [imageUrl]);

  // 2. 属性联动同步
  useEffect(() => {
    if (selectedId) {
      setElements(prev => prev.map(el => 
        el.id === selectedId ? { ...el, color: strokeColor, fillColor, strokeWidth, fontSize } : el
      ));
    }
  }, [strokeColor, fillColor, strokeWidth, fontSize, selectedId]);

  // 3. 画布主渲染循环
  useEffect(() => {
    if (!canvasRef.current || !canvasImage) return;
    const ctx = canvasRef.current.getContext('2d')!;
    
    // 设置物理像素尺寸
    canvasRef.current.width = canvasImage.width;
    canvasRef.current.height = canvasImage.height;
    
    // 渲染图层：底图 -> 动态元素
    ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);
    ctx.drawImage(canvasImage, 0, 0);
    
    elements.forEach(el => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.fillColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if ((el.type === 'brush' || el.type === 'ai-erase') && el.points) {
        if (el.type === 'ai-erase') ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        if (el.points.length > 0) {
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
        }
        ctx.stroke();
      } else if (el.type === 'rect' || el.type === 'select-fill') {
        if (el.fillColor !== 'transparent') ctx.fillRect(el.x, el.y, el.w, el.h);
        if (el.type === 'rect') ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'circle') {
        const radius = Math.sqrt(el.w ** 2 + el.h ** 2);
        ctx.beginPath();
        ctx.arc(el.x, el.y, radius, 0, Math.PI * 2);
        if (el.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + el.w, el.y + el.h); ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', el.x, el.y);
      } else if (el.type === 'crop') {
        ctx.setLineDash([10 / zoom, 10 / zoom]);
        ctx.strokeStyle = '#6366f1';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      }

      // 选中项物理提示
      if (el.id === selectedId) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(el.x - 5 / zoom, el.y - 5 / zoom, el.w + 10 / zoom, el.h + 10 / zoom);
      }
      ctx.restore();
    });
  }, [elements, canvasImage, selectedId, zoom, opacity]);

  const getCanvasPoint = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.touches?.length > 0) ? e.touches[0].clientX : e.clientX;
    const cy = (e.touches?.length > 0) ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) * (canvasRef.current.width / rect.width),
      y: (cy - rect.top) * (canvasRef.current.height / rect.height)
    };
  };

  const handleStart = (e: any) => {
    if (isProcessing) return;
    const pos = getCanvasPoint(e);
    
    if (currentTool === 'hand') { 
      setIsPanning(true); setLastPanPos({ x: e.clientX, y: e.clientY }); return; 
    }
    
    if (currentTool === 'select') { 
      const hit = [...elements].reverse().find(el => {
        const margin = 10 / zoom;
        return pos.x >= el.x - margin && pos.x <= el.x + el.w + margin && pos.y >= el.y - margin && pos.y <= el.y + el.h + margin;
      });
      if (hit) { 
        setSelectedId(hit.id); 
        setStrokeColor(hit.color); setFillColor(hit.fillColor); setStrokeWidth(hit.strokeWidth); setFontSize(hit.fontSize);
        setIsDragging(true); 
      } else setSelectedId(null); 
      return; 
    }
    
    setIsDragging(true); 
    const id = Math.random().toString(36).substring(2, 9);
    const newEl: EditorElement = { 
      id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0, 
      color: strokeColor, fillColor, strokeWidth, fontSize,
      points: (currentTool === 'brush' || currentTool === 'ai-erase') ? [pos] : undefined
    };
    
    if (currentTool === 'text') { 
      const txt = prompt(uiLang === 'zh' ? "输入文字" : "Enter text"); 
      if (!txt) { setIsDragging(false); return; } 
      newEl.text = txt; newEl.w = txt.length * (fontSize * 0.6); newEl.h = fontSize;
      setElements([...elements, newEl]); setSelectedId(id); setIsDragging(false); 
    } else { 
      setElements([...elements, newEl]); setSelectedId(id); 
    }
  };

  const handleMove = (e: any) => {
    if (isPanning) {
      setPan(p => ({ x: p.x + (e.clientX - lastPanPos.x), y: p.y + (e.clientY - lastPanPos.y) }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }
    if (!isDragging || !selectedId) return;
    const pos = getCanvasPoint(e);
    
    // 关键点：更新当前正在绘制的元素坐标
    setElements(prev => prev.map(el => { 
      if (el.id !== selectedId) return el; 
      if (el.type === 'brush' || el.type === 'ai-erase') return { ...el, points: [...(el.points || []), pos] }; 
      return { ...el, w: pos.x - el.x, h: pos.y - el.y }; 
    }));
  };

  const executeCrop = () => {
    const cropEl = elements.find(el => el.type === 'crop' && el.id === selectedId);
    if (!cropEl || !canvasRef.current) return;
    
    setIsProcessing(true);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.abs(cropEl.w);
    tempCanvas.height = Math.abs(cropEl.h);
    const tx = cropEl.w > 0 ? cropEl.x : cropEl.x + cropEl.w;
    const ty = cropEl.h > 0 ? cropEl.y : cropEl.y + cropEl.h;
    
    const tctx = tempCanvas.getContext('2d')!;
    tctx.drawImage(canvasRef.current, tx, ty, tempCanvas.width, tempCanvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
    
    const img = new Image();
    img.onload = () => {
      setCanvasImage(img);
      setElements([]);
      setSelectedId(null);
      setIsProcessing(false);
    };
    img.src = tempCanvas.toDataURL();
  };

  const handleCommit = async (isStandardized: boolean) => {
    if (!canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    setSelectedId(null);
    
    // 略微延迟确保 React 状态已同步到视图
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
        const fd = new FormData(); 
        fd.append('file', blob, `studio_${Date.now()}.jpg`);
        try { 
          const res = await fetch(TARGET_API, { method: 'POST', body: fd }); 
          const data = await res.json(); 
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url); 
        } finally { setIsProcessing(false); }
      }, 'image/jpeg', 0.98);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col font-inter overflow-hidden">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white z-[300] shadow-xl">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
          <div className="flex flex-col">
             <span className="font-black text-[10px] uppercase tracking-widest text-indigo-400">Media Studio v7.5</span>
             <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">HD Rendering Engine Active</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => handleCommit(true)} disabled={isProcessing} className="px-6 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-700 transition-all"><Maximize2 size={14}/> Standardize 1600</button>
          <button onClick={() => handleCommit(false)} disabled={isProcessing} className="px-10 py-2.5 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-[300]">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Select" />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={18}/>} label="Pan" />
           <div className="w-8 h-px bg-white/10 my-1"></div>
           
           <SideBtn active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelectedId(null); }} icon={<Palette size={18}/>} label="Brush" />
           <SideBtn active={currentTool === 'select-fill'} onClick={() => { setCurrentTool('select-fill'); setSelectedId(null); }} icon={<PaintBucket size={18}/>} label="Fill" />
           
           <div className="relative group">
              <button 
                onClick={() => { setCurrentTool(lastShape); setShowShapeMenu(!showShapeMenu); setSelectedId(null); }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${['rect', 'circle', 'line'].includes(currentTool) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
              >
                {lastShape === 'rect' ? <Square size={18}/> : lastShape === 'circle' ? <Circle size={18}/> : <Minus size={18} className="rotate-45" />}
                <ChevronDown size={8} className="absolute bottom-1 right-1 opacity-50" />
              </button>
              {showShapeMenu && (
                <div className="absolute left-full ml-3 top-0 bg-slate-800 border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col gap-2 z-[400] animate-in slide-in-from-left-2">
                   <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); }} className={`p-3 rounded-xl hover:bg-white/10 ${lastShape === 'rect' ? 'text-indigo-400' : 'text-slate-400'}`}><Square size={20}/></button>
                   <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); }} className={`p-3 rounded-xl hover:bg-white/10 ${lastShape === 'circle' ? 'text-indigo-400' : 'text-slate-400'}`}><Circle size={20}/></button>
                   <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); }} className={`p-3 rounded-xl hover:bg-white/10 ${lastShape === 'line' ? 'text-indigo-400' : 'text-slate-400'}`}><Minus size={20} className="rotate-45"/></button>
                </div>
              )}
              <span className="text-[7px] font-black uppercase text-slate-500 mt-1">Shapes</span>
           </div>

           <SideBtn active={currentTool === 'text'} onClick={() => { setCurrentTool('text'); setSelectedId(null); }} icon={<Type size={18}/>} label="Text" />
           <SideBtn active={currentTool === 'crop'} onClick={() => { setCurrentTool('crop'); setSelectedId(null); }} icon={<Scissors size={18}/>} label="Crop" />
           <SideBtn active={currentTool === 'ai-erase'} onClick={() => { setCurrentTool('ai-erase'); setSelectedId(null); }} icon={<Sparkles size={18}/>} label="AI Erase" />
           
           <div className="w-8 h-px bg-white/10 mt-auto"></div>
           {currentTool === 'crop' && selectedId && (
             <button onClick={executeCrop} className="p-3 text-indigo-400 hover:text-white bg-indigo-600/20 rounded-xl mb-2 animate-pulse"><Maximize2 size={20}/></button>
           )}
           <button onClick={() => { if(selectedId) setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500"><Trash2 size={20}/></button>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 bg-slate-950 cursor-crosshair overflow-hidden relative" 
          onMouseDown={handleStart} 
          onMouseMove={handleMove} 
          onMouseUp={() => setIsDragging(false)}
          onWheel={e => { e.preventDefault(); setZoom(z => Math.min(10, Math.max(0.05, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }}
        >
          {isProcessing && (
            <div className="absolute inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
              <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Synching Neural Fabric...</p>
            </div>
          )}
          
          <div 
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
              transformOrigin: 'center',
              transition: (isPanning || isDragging) ? 'none' : 'transform 0.1s ease-out'
            }} 
            className="inline-block shadow-[0_0_100px_rgba(0,0,0,1)] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <canvas ref={canvasRef} className="block" />
          </div>
          
          <div className="absolute bottom-8 right-8 px-6 py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white/50 shadow-2xl">
             {Math.round(zoom * 100)}% MAGNIFICATION
          </div>
        </div>

        <div className="w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 z-[300] overflow-y-auto text-white">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Stroke Width</label>
              <input type="range" min="1" max="200" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Stroke Color</label>
              <div className="grid grid-cols-5 gap-2">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#ff8800', '#ec4899', '#10b981'].map(c => (
                   <button key={c} onClick={() => setStrokeColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Fill Color</label>
              <div className="grid grid-cols-5 gap-2">
                 <button onClick={() => setFillColor('transparent')} className={`aspect-square rounded-lg border-2 flex items-center justify-center text-[8px] font-black uppercase ${fillColor === 'transparent' ? 'border-white bg-slate-800' : 'border-white/10 text-slate-700'}`}>None</button>
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899', '#10b981'].map(c => (
                   <button key={c} onClick={() => setFillColor(c)} style={{backgroundColor: c}} className={`aspect-square rounded-lg border-2 transition-all ${fillColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Text Size / Opacity</label>
              <input type="range" min="12" max="500" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer mb-2" />
              <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-14 flex flex-col items-center gap-1 group transition-all shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-2 ring-indigo-500 shadow-lg' : 'bg-white/5 hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[7px] font-black uppercase tracking-tighter opacity-50 group-hover:opacity-100">{label}</span>
  </button>
);
