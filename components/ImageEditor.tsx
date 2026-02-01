
import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Loader2, MousePointer2, Maximize2, Paintbrush, Square, Circle, Type, Trash2, Eraser, Hand, Minus, ChevronRight } from 'lucide-react';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'hand' | 'brush' | 'rect' | 'circle' | 'line' | 'text' | 'erase';
interface Element { 
  id: string; 
  type: Tool; 
  x: number; 
  y: number; 
  w?: number; 
  h?: number; 
  text?: string; 
  color: string; 
  fillColor: string;
  strokeWidth: number; 
  fontSize: number; 
  points?: {x: number, y: number}[]; 
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [lastShape, setLastShape] = useState<Tool>('rect'); // 记忆上一次形状
  const [isProcessing, setIsProcessing] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // 颜色与属性状态
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(12);
  const [fontSize, setFontSize] = useState(48);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);
  const [showShapesMenu, setShowShapesMenu] = useState(false);

  // 初始化加载图片逻辑
  useEffect(() => {
    const loadImage = async () => {
      if (!imageUrl) return;
      setIsProcessing(true);
      try {
        const proxiedUrl = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
          ? imageUrl 
          : `${CORS_PROXY}${encodeURIComponent(imageUrl)}?t=${Date.now()}`;
        
        const img = new Image();
        img.crossOrigin = "anonymous"; // 必须设置，否则后续无法保存图片
        img.src = proxiedUrl;
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = (e) => reject(new Error("Load Failed"));
        });
        
        setCanvasImage(img);
        // 初始化缩放：确保图片完整显示在可视区
        const initialZoom = Math.min((window.innerWidth - 600) / img.width, (window.innerHeight - 400) / img.height, 1);
        setZoom(initialZoom);
        setOffset({ x: 0, y: 0 });
        setIsProcessing(false);
      } catch (e) {
        console.error("Editor Image Load Error:", e);
        setIsProcessing(false);
      }
    };
    loadImage();
  }, [imageUrl]);

  // 画布重绘逻辑
  useEffect(() => {
    if (!canvasRef.current || !canvasImage) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    
    // 设置画布物理尺寸
    canvasRef.current.width = canvasImage.width;
    canvasRef.current.height = canvasImage.height;
    
    // 绘制原始底图
    ctx.drawImage(canvasImage, 0, 0);
    
    // 逐个绘制涂鸦层
    elements.forEach(el => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.fillColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'brush' && el.points) {
        ctx.beginPath();
        if (el.points.length) {
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
        }
        ctx.stroke();
      }
      else if (el.type === 'rect') {
        if (el.fillColor !== 'transparent') ctx.fillRect(el.x, el.y, el.w || 0, el.h || 0);
        ctx.strokeRect(el.x, el.y, el.w || 0, el.h || 0);
      }
      else if (el.type === 'circle') {
        const r = Math.sqrt((el.w || 0) ** 2 + (el.h || 0) ** 2);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        if (el.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      }
      else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + (el.w || 0), el.y + (el.h || 0));
        ctx.stroke();
      }
      else if (el.type === 'text') {
        ctx.font = `bold ${el.fontSize}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', el.x, el.y);
      }
      else if (el.type === 'erase' && el.points) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }

      // 绘制选中框
      if (el.id === selectedId) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 4 / zoom;
        ctx.strokeRect(el.x - 5, el.y - 5, (el.w || 0) + 10, (el.h || 0) + 10);
      }
      ctx.restore();
    });
  }, [elements, selectedId, canvasImage, zoom]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(0.05, prev * delta), 20));
  };
  
  const handleStart = (e: React.MouseEvent) => {
    if (!canvasRef.current || isProcessing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    
    // 抓手或移动工具：开启平移
    if (currentTool === 'hand') { 
      setIsPanning(true); 
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); 
      return; 
    }
    
    // 选择工具：查找元素
    if (currentTool === 'select') { 
      const clicked = [...elements].reverse().find(el => {
        const xMin = Math.min(el.x, el.x + (el.w || 0));
        const xMax = Math.max(el.x, el.x + (el.w || 0));
        const yMin = Math.min(el.y, el.y + (el.h || 0));
        const yMax = Math.max(el.y, el.y + (el.h || 0));
        return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
      });
      if (clicked) { setSelectedId(clicked.id); setIsDragging(true); } else { setSelectedId(null); } 
      return; 
    }
    
    // 创建新元素
    setIsDragging(true); 
    const id = Math.random().toString(36).substr(2, 9);
    const newEl: Element = { 
      id, type: currentTool, x: pos.x, y: pos.y, w: 0, h: 0, 
      color: strokeColor, fillColor: fillColor, strokeWidth, fontSize, 
      points: ['brush', 'erase'].includes(currentTool) ? [pos] : [] 
    };
    
    if (currentTool === 'text') { 
      const t = prompt("Text Content:"); 
      if (!t) { setIsDragging(false); return; } 
      newEl.text = t; 
      newEl.w = 100; newEl.h = 40; // 虚拟包围盒
      setElements([...elements, newEl]); 
      setSelectedId(id); 
      setIsDragging(false); 
    } else { 
      setElements([...elements, newEl]); 
      setSelectedId(id); 
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
    
    if (!isDragging || !selectedId || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    
    setElements(prev => prev.map(el => { 
      if (el.id !== selectedId) return el; 
      if (['brush', 'erase'].includes(el.type)) return { ...el, points: [...(el.points || []), pos] }; 
      return { ...el, w: pos.x - el.x, h: pos.y - el.y }; 
    }));
  };

  const handleEnd = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  const commitSync = async (isStandardized: boolean) => {
    if (!canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    setSelectedId(null);
    
    setTimeout(() => {
      const exportCanvas = document.createElement('canvas'); 
      const bctx = exportCanvas.getContext('2d')!;
      
      if (isStandardized) { 
        exportCanvas.width = 1600; exportCanvas.height = 1600; 
        bctx.fillStyle = '#FFFFFF'; 
        bctx.fillRect(0, 0, 1600, 1600); 
        const scale = Math.min(1500 / canvasRef.current!.width, 1500 / canvasRef.current!.height); 
        const dw = canvasRef.current!.width * scale, dh = canvasRef.current!.height * scale; 
        bctx.drawImage(canvasRef.current!, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh); 
      } else { 
        exportCanvas.width = canvasRef.current!.width; 
        exportCanvas.height = canvasRef.current!.height; 
        bctx.drawImage(canvasRef.current!, 0, 0); 
      }
      
      exportCanvas.toBlob(async (blob) => {
        if (!blob) return setIsProcessing(false);
        const fd = new FormData(); fd.append('file', blob, `editor_${Date.now()}.jpg`);
        try { 
          const res = await fetch(TARGET_API, { method: 'POST', body: fd }); 
          const data = await res.json(); 
          const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
          const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
          if (url) onSave(url); 
        } catch (e) {
          console.error("Save Error:", e);
        } finally { 
          setIsProcessing(false); 
        }
      }, 'image/jpeg', 0.98);
    }, 50);
  };

  const handleShapeSelect = (type: Tool) => {
    setCurrentTool(type);
    setLastShape(type);
    setShowShapesMenu(false);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col font-inter overflow-hidden">
      {/* 顶部固定栏 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between text-white z-[300] shadow-2xl">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
          <div className="flex flex-col">
             <span className="font-black text-[10px] uppercase tracking-widest text-indigo-400">Media Studio v5.2</span>
             <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Powered by HMSTU Image Engine</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => commitSync(true)} disabled={isProcessing} className="px-6 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all hover:bg-slate-700 disabled:opacity-50"><Maximize2 size={14}/> Auto-Standardize 1600</button>
          <button onClick={() => commitSync(false)} disabled={isProcessing} className="px-10 py-2.5 bg-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">{isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit Sync</button>
        </div>
      </div>
      
      <div className="flex-1 flex pt-16 relative overflow-hidden">
        {/* 左侧形状选择组 */}
        <div className="fixed left-0 top-16 bottom-0 w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 gap-5 z-[300]">
           <SideBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Move" />
           <SideBtn active={currentTool === 'hand'} onClick={() => setCurrentTool('hand')} icon={<Hand size={18}/>} label="Pan" />
           <div className="w-8 h-px bg-white/10 my-2"></div>
           
           <SideBtn active={currentTool === 'brush'} onClick={() => setCurrentTool('brush')} icon={<Paintbrush size={18}/>} label="Brush" />
           
           {/* 简单图形折叠组 */}
           <div className="relative">
              <button 
                onClick={() => { setCurrentTool(lastShape); setShowShapesMenu(!showShapesMenu); }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${['rect','circle','line'].includes(currentTool) ? 'bg-indigo-600/20 ring-2 ring-indigo-500 text-indigo-400' : 'bg-white/5 hover:bg-white/10 text-slate-500'}`}
              >
                {lastShape === 'rect' ? <Square size={18}/> : lastShape === 'circle' ? <Circle size={18}/> : <Minus size={18} className="rotate-45" />}
              </button>
              {showShapesMenu && (
                <div className="absolute left-full ml-2 top-0 bg-slate-800 border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col gap-2 animate-in slide-in-from-left-2 z-[400]">
                   <button onClick={() => handleShapeSelect('rect')} className={`p-3 rounded-xl hover:bg-white/10 ${lastShape === 'rect' ? 'text-indigo-400' : 'text-slate-400'}`}><Square size={18}/></button>
                   <button onClick={() => handleShapeSelect('circle')} className={`p-3 rounded-xl hover:bg-white/10 ${lastShape === 'circle' ? 'text-indigo-400' : 'text-slate-400'}`}><Circle size={18}/></button>
                   <button onClick={() => handleShapeSelect('line')} className={`p-3 rounded-xl hover:bg-white/10 ${lastShape === 'line' ? 'text-indigo-400' : 'text-slate-400'}`}><Minus size={18} className="rotate-45" /></button>
                </div>
              )}
              <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500 mt-1 block text-center">Shapes</span>
           </div>

           <SideBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} icon={<Type size={18}/>} label="Text" />
           <SideBtn active={currentTool === 'erase'} onClick={() => setCurrentTool('erase')} icon={<Eraser size={18}/>} label="Eraser" />
           
           <button onClick={() => { if(selectedId) setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); }} className="p-3 text-slate-500 hover:text-red-500 mt-auto transition-colors"><Trash2 size={20}/></button>
        </div>

        {/* 交互工作区 */}
        <div 
          className="flex-1 bg-slate-950 cursor-crosshair overflow-hidden relative ml-20 mr-72" 
          onWheel={handleWheel} 
          onMouseDown={handleStart} 
          onMouseMove={handleMove} 
          onMouseUp={handleEnd} 
          onMouseLeave={handleEnd}
        >
          {isProcessing && (
            <div className="absolute inset-0 z-[400] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
              <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Preparing Visual Tokens...</p>
            </div>
          )}
          
          <div 
            style={{ 
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, 
              transformOrigin: 'center', 
              transition: isPanning ? 'none' : 'transform 0.1s ease-out' 
            }} 
            className="inline-block shadow-[0_0_100px_rgba(0,0,0,0.8)] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <canvas ref={canvasRef} className="block" />
          </div>
          <div className="absolute bottom-8 right-8 px-5 py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white/50 shadow-2xl">
             {Math.round(zoom * 100)}% MAGNIFICATION
          </div>
        </div>

        {/* 右侧属性栏 */}
        <div className="fixed right-0 top-16 bottom-0 w-72 bg-slate-900 border-l border-white/5 p-8 space-y-10 z-[300] overflow-y-auto custom-scrollbar text-white">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Stroke Width</label>
              <input type="range" min="1" max="150" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none" />
              <div className="flex justify-between text-[8px] font-black text-slate-600"><span>1PX</span><span>150PX</span></div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Stroke Color</label>
              <div className="grid grid-cols-5 gap-2">
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff', '#ff8800', '#6366f1'].map(c => (
                   <button 
                     key={c} 
                     onClick={() => setStrokeColor(c)} 
                     style={{backgroundColor: c}} 
                     className={`aspect-square rounded-lg border-2 transition-all ${strokeColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                   />
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fill Color</label>
              <div className="grid grid-cols-5 gap-2">
                 <button 
                   onClick={() => setFillColor('transparent')} 
                   className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-[8px] font-black uppercase ${fillColor === 'transparent' ? 'border-white bg-white/10' : 'border-white/20 text-white/20'}`}
                 >
                   None
                 </button>
                 {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#6366f1', '#fbbf24', '#ec4899'].map(c => (
                   <button 
                     key={c} 
                     onClick={() => setFillColor(c)} 
                     style={{backgroundColor: c}} 
                     className={`aspect-square rounded-lg border-2 transition-all ${fillColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                   />
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Text Size</label>
              <input type="range" min="12" max="300" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none" />
           </div>

           <div className="pt-10 border-t border-white/5 opacity-50 space-y-4">
              <p className="text-[9px] font-medium text-slate-400 leading-relaxed uppercase tracking-tighter">
                Tip: Use mouse wheel to zoom. <br/>Drag with Hand tool or Move tool to navigate the canvas.
              </p>
              <div className="bg-indigo-600/10 p-4 rounded-2xl border border-indigo-500/20">
                 <p className="text-[8px] font-black text-indigo-400 uppercase leading-normal">Smart Detection: Elements are resolution-independent and will remain sharp during export.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const SideBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-14 flex flex-col items-center gap-1 group transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 ring-2 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter opacity-50 group-hover:opacity-100">{label}</span>
  </button>
);
