
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Scissors, PaintBucket, Save, Loader2, MousePointer2, 
  Type, Square, Circle, Minus, Palette, Maximize2, 
  Sparkles, ChevronDown, Trash2, Hand, Eraser, Pipette
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
  
  // 属性状态
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [fontSize, setFontSize] = useState(64);
  const [opacity, setOpacity] = useState(1);

  // 视口控制
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  // 绘制状态
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  // 1. 强化加载逻辑：修复加载失败
  useEffect(() => {
    if (!imageUrl) return;
    setIsProcessing(true);
    
    const img = new Image();
    // 关键修复：跨域声明必须在赋值 src 之前
    img.crossOrigin = "anonymous";
    
    const proxiedUrl = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
      ? imageUrl 
      : `${CORS_PROXY}${encodeURIComponent(imageUrl)}&_t=${Date.now()}`;
    
    img.onload = () => {
      setImgObj(img);
      setIsProcessing(false);
      // 初始居中及缩放适配
      const scale = Math.min(window.innerWidth * 0.6 / img.width, window.innerHeight * 0.6 / img.height, 1);
      setZoom(scale);
    };
    img.onerror = () => {
      alert("System Physics Error: Canvas Bitstream Load Failed.");
      setIsProcessing(false);
    };
    img.src = proxiedUrl;
  }, [imageUrl]);

  // 2. 实时渲染引擎
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
           ctx.lineWidth = 2 / zoom;
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
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        const boxH = el.type === 'text' ? el.fontSize : el.h;
        ctx.strokeRect(el.x - 2, el.y - 2, el.w + 4, boxH + 4);
      }
      ctx.restore();
    });
  }, [elements, imgObj, selectedId, zoom, opacity]);

  // 3. 物理坐标换算：使用直接偏移量
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // 物理缩放比
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

    // 吸色器逻辑
    if (currentTool === 'picker') {
      const ctx = canvasRef.current!.getContext('2d')!;
      const pixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
      setStrokeColor(hex);
      setCurrentTool('brush');
      return;
    }

    if (currentTool === 'hand') {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (currentTool === 'select') {
      const hit = [...elements].reverse().find(el => {
        const hitZone = 15 / zoom;
        const h = el.type === 'text' ? el.fontSize : el.h;
        const xMin = Math.min(el.x, el.x + el.w) - hitZone;
        const xMax = Math.max(el.x, el.x + el.w) + hitZone;
        const yMin = Math.min(el.y, el.y + el.h) - hitZone;
        const yMax = Math.max(el.y, el.y + (el.type === 'text' ? el.fontSize : el.h)) + hitZone;
        return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
      });
      if (hit) {
        setSelectedId(hit.id);
        setStrokeColor(hit.color);
        setStrokeWidth(hit.strokeWidth);
        setFontSize(hit.fontSize);
      } else {
        setSelectedId(null);
      }
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
        fd.append('file', blob, `studio_${Date.now()}.jpg`);
        try {
          const res = await fetch(TARGET_API, { method: 'POST', body: fd });
          const data = await res.json();
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : (data.url || data.data?.url);
          const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url);
        } catch (e) {
          alert("Network Sync Failed.");
        } finally {
          setIsProcessing(false);
        }
      }, 'image/jpeg', 0.95);
    }, 100);
  };

  const executeCrop = () => {
    const el = elements.find(x => x.id === selectedId && x.type === 'crop');
    if (!el || !canvasRef.current) return;
    setIsProcessing(true);
    const temp = document.createElement('canvas');
    const cw = Math.abs(el.w); const ch = Math.abs(el.h);
    if (cw < 5 || ch < 5) { setIsProcessing(false); return; }
    temp.width = cw; temp.height = ch;
    const tctx = temp.getContext('2d')!;
    const sx = el.w > 0 ? el.x : el.x + el.w;
    const sy = el.h > 0 ? el.y : el.y + el.h;
    tctx.drawImage(canvasRef.current, sx, sy, cw, ch, 0, 0, cw, ch);
    const img = new Image();
    img.onload = () => { setImgObj(img); setElements([]); setSelectedId(null); setIsProcessing(false); };
    img.src = temp.toDataURL('image/jpeg');
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col font-inter select-none overflow-hidden text-white">
      <div className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
          <div className="flex flex-col">
            <span className="font-black text-[10px] uppercase tracking-widest text-indigo-400">AMZBot Studio Engine v12.0</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase italic">Pixel Calibration Verified</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleCommit(true)} className="px-5 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-700 transition-all"><Maximize2 size={14}/> 1600 Std</button>
          <button onClick={() => handleCommit(false)} disabled={isProcessing} className="px-10 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700">
            {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧垂直工具栏 */}
        <div className="w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-4 shrink-0">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={18}/>} />
           <div className="w-8 h-px bg-white/10 my-1"></div>
           <SideBtn active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelectedId(null); }} icon={<Palette size={18}/>} />
           <SideBtn active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={18}/>} />
           <div className="relative">
             <SideBtn active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={lastShape === 'rect' ? <Square size={18}/> : lastShape === 'circle' ? <Circle size={18}/> : <Minus size={18} className="rotate-45" />} />
             {showShapeMenu && (
               <div className="absolute left-full ml-2 top-0 bg-slate-800 border border-white/10 p-2 rounded-xl flex flex-col gap-2 z-[1100] shadow-2xl">
                 <button onClick={() => { setCurrentTool('rect'); setLastShape('rect'); setShowShapeMenu(false); }} className={`p-3 rounded-lg hover:bg-white/10 ${lastShape === 'rect' ? 'text-indigo-400' : 'text-slate-400'}`}><Square size={20}/></button>
                 <button onClick={() => { setCurrentTool('circle'); setLastShape('circle'); setShowShapeMenu(false); }} className={`p-3 rounded-lg hover:bg-white/10 ${lastShape === 'circle' ? 'text-indigo-400' : 'text-slate-400'}`}><Circle size={20}/></button>
                 <button onClick={() => { setCurrentTool('line'); setLastShape('line'); setShowShapeMenu(false); }} className={`p-3 rounded-lg hover:bg-white/10 ${lastShape === 'line' ? 'text-indigo-400' : 'text-slate-400'}`}><Minus size={20} className="rotate-45"/></button>
               </div>
             )}
           </div>
           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} />
           <SideBtn active={currentTool === 'crop'} onClick={() => setCurrentTool('crop')} icon={<Scissors size={18}/>} />
           <SideBtn active={currentTool === 'ai-erase'} onClick={() => setCurrentTool('ai-erase')} icon={<Eraser size={18}/>} />
           <div className="mt-auto flex flex-col gap-2">
             {currentTool === 'crop' && selectedId && (
               <button onClick={executeCrop} className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center animate-pulse shadow-lg shadow-indigo-900/40"><Check size={20}/></button>
             )}
             <button onClick={() => { if(selectedId) setElements(prev => prev.filter(x => x.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
           </div>
        </div>

        {/* 画布核心交互区 */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center">
          {isProcessing && <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[1200] flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48}/></div>}
          
          <div 
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
              transformOrigin: 'center',
              transition: (isPanning || isDrawing) ? 'none' : 'transform 0.1s ease-out'
            }} 
            className="shadow-[0_0_150px_rgba(0,0,0,0.8)] relative bg-white"
          >
            <canvas 
              ref={canvasRef} 
              className={`block ${currentTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
              onMouseDown={handleMouseDown} 
              onMouseMove={handleMouseMove} 
              onMouseUp={handleMouseUp} 
              onMouseLeave={handleMouseUp}
            />
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50">
            {Math.round(zoom * 100)}% HD Canvas
          </div>
        </div>

        {/* 右侧属性调节面板 */}
        <div className="w-72 bg-slate-900 border-l border-white/5 p-8 text-white space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
           {/* 线框/画笔 */}
           <div className="space-y-6">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block border-b border-indigo-500/20 pb-2">Drawing Physics</label>
              <PropGroup label={`Stroke Width: ${strokeWidth}px`}>
                <input type="range" min="1" max="250" value={strokeWidth} onChange={e => { const v = parseInt(e.target.value); setStrokeWidth(v); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, strokeWidth: v} : el)) }} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg" />
              </PropGroup>
              <div className="space-y-3">
                 <p className="text-[9px] font-black text-slate-500 uppercase">Current Hue</p>
                 <div className="grid grid-cols-5 gap-2">
                   {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899', '#10b981'].map(c => (
                     <button key={c} onClick={() => { setStrokeColor(c); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, color: c} : el)) }} style={{backgroundColor: c}} className={`w-9 h-9 rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} />
                   ))}
                 </div>
              </div>
           </div>

           {/* 字体属性 */}
           <div className="space-y-6">
              <label className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] block border-b border-amber-500/20 pb-2">Typography Scale</label>
              <PropGroup label={`Font Size: ${fontSize}px`}>
                <input type="range" min="12" max="600" value={fontSize} onChange={e => { const v = parseInt(e.target.value); setFontSize(v); if(selectedId) setElements(prev => prev.map(el => el.id === selectedId ? {...el, fontSize: v} : el)) }} className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg" />
              </PropGroup>
           </div>

           {/* 透明度 */}
           <div className="space-y-6">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] block border-b border-emerald-500/20 pb-2">Atmosphere</label>
              <PropGroup label={`Global Opacity: ${Math.round(opacity * 100)}%`}>
                <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg" />
              </PropGroup>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40 ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{icon}</button>
);

const PropGroup = ({ label, children }: any) => (
  <div className="space-y-3">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const Check = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);
