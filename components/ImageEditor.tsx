
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Wand2, Loader2, MousePointer2, Maximize, 
  Type, Square, Circle, Minus, Palette, ZoomIn, ZoomOut, Move, Maximize2, Sparkles
} from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  uiLang: UILanguage;
}

type Tool = 'select' | 'select-fill' | 'brush' | 'ai-erase' | 'crop' | 'rect' | 'circle' | 'line' | 'text' | 'pan';

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
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

/**
 * 深度修复的本地 Inpainting 算法
 * 使用边缘向中心扩散的高性能扩散算法
 */
const localInpaint = (ctx: CanvasRenderingContext2D, maskCtx: CanvasRenderingContext2D, width: number, height: number) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const maskData = maskCtx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const mData = maskData.data;
  
  const mask = new Uint8Array(width * height);
  let pixelsToFix = 0;
  
  for (let i = 0; i < mData.length; i += 4) {
    if (mData[i] > 0) { // 检查红色分量
      mask[i / 4] = 1;
      pixelsToFix++;
    }
  }

  if (pixelsToFix === 0) return;

  const temp = new Uint8ClampedArray(data);
  const iterations = 30; // 增加迭代以确保大面积 Logo 完全消失

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (mask[i] === 1) {
          let r=0, g=0, b=0, count=0;
          // 检查邻域，只从非遮罩（干净）像素取样
          const neighbors = [i-width-1, i-width, i-width+1, i-1, i+1, i+width-1, i+width, i+width+1];
          for (const ni of neighbors) {
            if (mask[ni] === 0) {
              r += temp[ni * 4];
              g += temp[ni * 4 + 1];
              b += temp[ni * 4 + 2];
              count++;
            }
          }
          if (count > 0) {
            data[i * 4] = r / count;
            data[i * 4 + 1] = g / count;
            data[i * 4 + 2] = b / count;
            data[i * 4 + 3] = 255;
            mask[i] = 0; // 填补后标记为可用参考点
          }
        }
      }
    }
    temp.set(data);
  }
  ctx.putImageData(imgData, 0, 0);
};

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); 
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // 用于绘制条纹预览
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(40);
  const [fontSize, setFontSize] = useState(40);      
  const [opacity, setOpacity] = useState(1); 
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [lastUsedShape, setLastUsedShape] = useState<'rect' | 'circle' | 'line'>('rect');
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<{x1:number, y1:number, x2:number, y2:number} | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<EditorState[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, clientX: 0, clientY: 0 });

  const stripePatternRef = useRef<CanvasPattern | null>(null);
  const patternOffsetRef = useRef(0);

  useEffect(() => {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 30; patternCanvas.height = 30;
    const pctx = patternCanvas.getContext('2d')!;
    pctx.fillStyle = 'rgba(255,255,255,0.4)'; pctx.fillRect(0,0,30,30);
    pctx.strokeStyle = 'rgba(0,0,0,0.4)'; pctx.lineWidth = 8;
    pctx.beginPath(); pctx.moveTo(0, 30); pctx.lineTo(30, 0); pctx.stroke();
    const ctx = document.createElement('canvas').getContext('2d')!;
    stripePatternRef.current = ctx.createPattern(patternCanvas, 'repeat');

    const anim = () => {
      patternOffsetRef.current = (patternOffsetRef.current + 0.8) % 30;
      if (isDrawing && currentTool === 'ai-erase') redrawOverlay();
      requestAnimationFrame(anim);
    };
    const reqId = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(reqId);
  }, [isDrawing, currentTool]);

  const redrawOverlay = () => {
    const oCanvas = overlayCanvasRef.current;
    if (!oCanvas) return;
    const oCtx = oCanvas.getContext('2d')!;
    oCtx.clearRect(0, 0, oCanvas.width, oCanvas.height);
    if (!stripePatternRef.current) return;

    // 将逻辑遮罩（maskCanvas）的内容作为剪切路径，在其上填充滚动的斜纹
    oCtx.save();
    oCtx.translate(patternOffsetRef.current, 0);
    oCtx.fillStyle = stripePatternRef.current;
    // 这里我们直接利用已经画在 maskCanvas 上的“红色笔迹”
    oCtx.globalAlpha = 1;
    // 技巧：利用绘图模式只在 mask 有像素的地方画
    oCtx.globalCompositeOperation = 'source-over';
    
    // 我们需要把 maskCanvas 的形状画到 overlay 上
    const mCanvas = maskCanvasRef.current;
    if (mCanvas) {
       // 将 mask 复制到临时绘制
       oCtx.drawImage(mCanvas, -patternOffsetRef.current, 0);
       oCtx.globalCompositeOperation = 'source-in';
       oCtx.fillRect(-patternOffsetRef.current, 0, oCanvas.width + 30, oCanvas.height);
    }
    oCtx.restore();
  };

  useEffect(() => {
    const initCanvas = async () => {
      const canvas = canvasRef.current;
      const mCanvas = maskCanvasRef.current;
      const oCanvas = overlayCanvasRef.current;
      if (!canvas || !mCanvas || !oCanvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      setIsProcessing(true);
      try {
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = localUrl;
        img.onload = () => {
          canvas.width = mCanvas.width = oCanvas.width = img.width;
          canvas.height = mCanvas.height = oCanvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          if (containerRef.current) {
            const scale = Math.min((containerRef.current.clientWidth - 100) / img.width, (containerRef.current.clientHeight - 100) / img.height, 0.9);
            setZoom(scale || 1);
          }
          setHistory([{ canvasData: canvas.toDataURL('image/png'), objects: [] }]);
          setIsProcessing(false);
          URL.revokeObjectURL(localUrl);
        };
      } catch (err) { setIsProcessing(false); }
    };
    initCanvas();
  }, [imageUrl]);

  const saveToHistory = useCallback((currentObjects?: EditorObject[]) => {
    if (canvasRef.current) {
      setHistory(prev => [...prev.slice(-30), { canvasData: canvasRef.current!.toDataURL('image/png'), objects: currentObjects ? [...currentObjects] : [...objects] }]);
    }
  }, [objects]);

  const handleSmartErase = async () => {
    const canvas = canvasRef.current;
    const mCanvas = maskCanvasRef.current;
    const oCanvas = overlayCanvasRef.current;
    if (!canvas || !mCanvas || !oCanvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const mCtx = mCanvas.getContext('2d')!;
    const oCtx = oCanvas.getContext('2d')!;

    setIsProcessing(true);
    
    // 无论哪种模式，清除 Overlay 预览
    oCtx.clearRect(0, 0, oCanvas.width, oCanvas.height);

    if (process.env.API_KEY && process.env.API_KEY !== 'undefined') {
      try {
        const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        const maskBase64 = mCanvas.toDataURL('image/png').split(',')[1];
        const result = await editImageWithAI(base64, "Erase highlighted parts using the mask.");
        const img = new Image(); img.src = `data:image/jpeg;base64,${result}`;
        img.onload = () => {
          ctx.clearRect(0,0,canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          mCtx.clearRect(0,0,mCanvas.width, mCanvas.height);
          saveToHistory(); setIsProcessing(false); setCurrentTool('select');
        };
        return;
      } catch (e) { console.warn("Fallback to local..."); }
    }

    // 本地修复逻辑
    setTimeout(() => {
      localInpaint(ctx, mCtx, canvas.width, canvas.height);
      mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
      saveToHistory();
      setIsProcessing(false);
      setCurrentTool('select');
    }, 800); // 留出一点动画时间看“贪吃蛇”
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    const hit = objects.slice().reverse().find(o => pos.x >= o.x && pos.x <= o.x+o.width && pos.y >= o.y && pos.y <= o.y+o.height);

    if (currentTool === 'pan' || (currentTool === 'select' && !hit && !selectedObjectId)) {
      setIsPanning(true); setLastPanPos({ x: 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX, y: 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY }); return;
    }

    setStartPos(pos);
    if (currentTool === 'select') {
      if (selectedObjectId) {
        const obj = objects.find(o => o.id === selectedObjectId);
        if (obj) {
          const handleSize = 12/zoom; const centerX = obj.x + obj.width/2;
          if (Math.sqrt((pos.x-centerX)**2 + (pos.y-(obj.y-30/zoom))**2) < handleSize) { setIsRotating(true); return; }
          if (pos.x >= obj.x+obj.width-handleSize && pos.y >= obj.y+obj.height-handleSize) { setIsResizing(true); return; }
          if (pos.x >= obj.x && pos.x <= obj.x+obj.width && pos.y >= obj.y && pos.y <= obj.y+obj.height) { setIsDragging(true); setDragOffset({x: pos.x-obj.x, y: pos.y-obj.y}); return; }
        }
      }
      if (hit) { setSelectedObjectId(hit.id); setIsDragging(true); setDragOffset({x: pos.x-hit.x, y: pos.y-hit.y}); }
      else setSelectedObjectId(null);
      return;
    }

    setIsDrawing(true);
    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) setSelection({x1:pos.x, y1:pos.y, x2:pos.x, y2:pos.y});
    
    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const mCtx = maskCanvasRef.current?.getContext('2d')!;
      const ctx = canvasRef.current?.getContext('2d')!;
      if (currentTool === 'brush') {
         ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
      } else {
         mCtx.beginPath(); mCtx.moveTo(pos.x, pos.y);
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const pos = getMousePos(e);
    setMousePos({ ...pos, clientX, clientY });

    if (isPanning) { setPan(p => ({ x: p.x + (clientX - lastPanPos.x), y: p.y + (clientY - lastPanPos.y) })); setLastPanPos({ x: clientX, y: clientY }); return; }
    
    if (currentTool === 'select' && selectedObjectId) {
      if (isDragging) setObjects(prev => prev.map(o => o.id === selectedObjectId ? {...o, x: pos.x-dragOffset.x, y: pos.y-dragOffset.y} : o));
      else if (isResizing) setObjects(prev => prev.map(o => o.id === selectedObjectId ? {...o, width: Math.max(10, pos.x-o.x), height: Math.max(10, pos.y-o.y)} : o));
      else if (isRotating) { setObjects(prev => prev.map(o => o.id === selectedObjectId ? {...o, rotation: Math.atan2(pos.y-(o.y+o.height/2), pos.x-(o.x+o.width/2)) + Math.PI/2} : o)); }
      return;
    }

    if (!isDrawing) return;
    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) setSelection(p => p ? {...p, x2: pos.x, y2: pos.y} : null);
    else {
      if (currentTool === 'ai-erase') {
        const mCtx = maskCanvasRef.current?.getContext('2d')!;
        mCtx.lineCap = 'round'; mCtx.lineJoin = 'round';
        mCtx.strokeStyle = 'red'; mCtx.lineWidth = strokeWidth; 
        mCtx.lineTo(pos.x, pos.y); mCtx.stroke();
        redrawOverlay();
      } else if (currentTool === 'brush') {
        const ctx = canvasRef.current?.getContext('2d')!;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.globalAlpha = opacity; ctx.lineTo(pos.x, pos.y); ctx.stroke();
      }
    }
  };

  const handleEnd = async () => {
    if (isPanning) { setIsPanning(false); return; }
    if (currentTool === 'select') { if (isDragging || isResizing || isRotating) saveToHistory(objects); setIsDragging(false); setIsResizing(false); setIsRotating(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentTool === 'ai-erase') {
      handleSmartErase();
      setSelection(null);
      return;
    }

    if (currentTool === 'select-fill' && selection) {
      const x = Math.min(selection.x1, selection.x2); const y = Math.min(selection.y1, selection.y2);
      const w = Math.abs(selection.x1 - selection.x2); const h = Math.abs(selection.y1 - selection.y2);
      if (w > 2 && h > 2) {
        const newObj: EditorObject = { id: crypto.randomUUID(), type: 'rect', x, y, width: w, height: h, rotation: 0, stroke: 'transparent', fill: fillColor, strokeWidth: 0, opacity: opacity };
        setObjects([...objects, newObj]); saveToHistory([...objects, newObj]); setCurrentTool('select');
      }
      setSelection(null); return;
    }

    if (['rect', 'circle', 'line'].includes(currentTool)) {
      const newObj: EditorObject = { id: crypto.randomUUID(), type: currentTool as any, x: Math.min(startPos.x, mousePos.x), y: Math.min(startPos.y, mousePos.y), width: Math.abs(startPos.x-mousePos.x), height: Math.abs(startPos.y-mousePos.y), rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: strokeWidth, opacity: opacity };
      setObjects([...objects, newObj]); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory([...objects, newObj]);
    } else if (currentTool === 'text') {
      const text = window.prompt("Enter text:"); if (text) {
        const newObj: EditorObject = { id: crypto.randomUUID(), type: 'text', x: mousePos.x, y: mousePos.y, width: text.length*fontSize*0.6, height: fontSize, rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: 1, fontSize: fontSize, opacity: opacity, text: text };
        setObjects([...objects, newObj]); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory([...objects, newObj]);
      }
    } else if (currentTool === 'brush') { saveToHistory(); }
    setSelection(null);
  };

  const getMousePos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) / zoom, y: (cy - rect.top) / zoom };
  };

  const perimeter = canvasRef.current ? (canvasRef.current.width + canvasRef.current.height) * 2 : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-inter overflow-hidden" style={{ cursor: currentTool === 'ai-erase' ? 'none' : 'default' }}>
      {/* 1600px 标准化按钮 & 顶栏 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shadow-xl z-50">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
          <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">AI Media Lab</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => {
            const canvas = canvasRef.current; if (!canvas) return;
            const temp = document.createElement('canvas'); temp.width = 1600; temp.height = 1600;
            const tCtx = temp.getContext('2d')!; tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0,0,1600,1600);
            const scale = Math.min(1500/canvas.width, 1500/canvas.height);
            tCtx.drawImage(canvas, (1600-canvas.width*scale)/2, (1600-canvas.height*scale)/2, canvas.width*scale, canvas.height*scale);
            canvas.width = 1600; canvas.height = 1600; canvas.getContext('2d')!.drawImage(temp, 0, 0);
            maskCanvasRef.current!.width = overlayCanvasRef.current!.width = 1600;
            maskCanvasRef.current!.height = overlayCanvasRef.current!.height = 1600;
            setZoom(Math.min((containerRef.current!.clientWidth-100)/1600, (containerRef.current!.clientHeight-100)/1600, 1));
            saveToHistory([]);
          }} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <Maximize2 size={14} className="text-blue-400" /> Standardize 1600px
          </button>
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setZoom(z => Math.max(0.05, z-0.1))} className="p-2 text-slate-400"><ZoomOut size={16} /></button>
            <span className="px-3 flex items-center text-[10px] font-black w-16 justify-center">{(zoom*100).toFixed(0)}%</span>
            <button onClick={() => setZoom(z => Math.min(10, z+0.1))} className="p-2 text-slate-400"><ZoomIn size={16} /></button>
          </div>
          <button onClick={() => {
            const hist = [...history]; hist.pop(); const prev = hist[hist.length-1];
            if (prev) {
              const img = new Image(); img.src = prev.canvasData;
              img.onload = () => { canvasRef.current!.getContext('2d')!.drawImage(img, 0, 0); setObjects(prev.objects); setHistory(hist); };
            }
          }} disabled={history.length<=1} className="p-2.5 bg-slate-800 disabled:opacity-30 rounded-xl text-slate-300"><Undo size={18} /></button>
          <button onClick={async () => {
             const canvas = canvasRef.current; if (!canvas) return;
             setIsProcessing(true);
             canvas.toBlob(async (blob) => {
               if (!blob) return;
               const fd = new FormData(); fd.append('file', new File([blob], `edit_${Date.now()}.jpg`, { type: 'image/jpeg' }));
               try {
                 const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
                 const data = await res.json();
                 const u = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
                 if (u) onSave(u);
               } catch (e) { alert("Save failed"); setIsProcessing(false); }
             }, 'image/jpeg', 0.9);
          }} disabled={isProcessing} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save & Apply
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div ref={containerRef} onWheel={e => { e.preventDefault(); setZoom(z => Math.min(10, Math.max(0.05, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }} className="flex-1 bg-slate-950 relative overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="absolute origin-center" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, top: '50%', left: '50%', marginTop: canvasRef.current ? -canvasRef.current.height/2 : 0, marginLeft: canvasRef.current ? -canvasRef.current.width/2 : 0 }}>
          
          {/* Win11 “贪吃蛇”加载边框 */}
          {isProcessing && canvasRef.current && (
            <div className="absolute -inset-[4px] z-[60] pointer-events-none">
              <svg width="100%" height="100%" className="absolute inset-0">
                {/* 浅蓝色底框 */}
                <rect 
                  x="1" y="1" 
                  width="calc(100% - 2px)" height="calc(100% - 2px)" 
                  fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  className="opacity-30"
                />
                {/* 深蓝色贪吃蛇段 */}
                <rect 
                  x="1" y="1" 
                  width="calc(100% - 2px)" height="calc(100% - 2px)" 
                  fill="none" 
                  stroke="#2563eb" 
                  strokeWidth="3" 
                  strokeDasharray={`${perimeter * 0.2} ${perimeter * 0.8}`}
                  className="animate-[snake_3s_linear_infinite]"
                />
              </svg>
            </div>
          )}

          <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white overflow-hidden rounded-sm">
            <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} className="block" />
            <canvas ref={maskCanvasRef} className="hidden" />
            {/* Overlay 层：专门用于展示条纹预览 */}
            <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
            
            <svg className="absolute inset-0 pointer-events-none w-full h-full z-20" viewBox={`0 0 ${canvasRef.current?.width||0} ${canvasRef.current?.height||0}`}>
              {selection && <rect x={Math.min(selection.x1, selection.x2)} y={Math.min(selection.y1, selection.y2)} width={Math.abs(selection.x1-selection.x2)} height={Math.abs(selection.y1-selection.y2)} fill={currentTool==='select-fill'?fillColor:'none'} stroke={strokeColor} strokeWidth={2} strokeDasharray="5,5" />}
              {objects.map(obj => (
                <g key={obj.id} transform={`rotate(${obj.rotation*180/Math.PI} ${obj.x+obj.width/2} ${obj.y+obj.height/2})`} opacity={obj.opacity}>
                  {obj.type==='rect' && <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type==='circle' && <ellipse cx={obj.x+obj.width/2} cy={obj.y+obj.height/2} rx={obj.width/2} ry={obj.height/2} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type==='line' && <line x1={obj.x} y1={obj.y} x2={obj.x+obj.width} y2={obj.y+obj.height} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type==='text' && <text x={obj.x} y={obj.y+obj.height} fill={obj.fill} style={{font:`bold ${obj.fontSize}px Inter`}}>{obj.text}</text>}
                  {selectedObjectId===obj.id && <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} fill="none" stroke="#6366f1" strokeWidth={2/zoom} strokeDasharray="4" />}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Win11 动态旋转虚线光标 */}
        {currentTool === 'ai-erase' && !isProcessing && (
          <div 
            className="fixed pointer-events-none z-[200] flex items-center justify-center"
            style={{ 
              left: mousePos.clientX, 
              top: mousePos.clientY, 
              width: strokeWidth * zoom, 
              height: strokeWidth * zoom,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="w-full h-full border-2 border-white border-dashed rounded-full animate-[spin_4s_linear_infinite] shadow-[0_0_10px_rgba(0,0,0,0.5)]"></div>
          </div>
        )}

        {/* Sidebar Tools */}
        <div className="fixed left-6 top-1/2 -translate-y-1/2 w-16 bg-slate-900/90 backdrop-blur-xl border border-slate-800 flex flex-col items-center py-6 gap-6 rounded-3xl shadow-2xl z-50">
          <ToolIcon active={currentTool==='select'} onClick={()=>{setCurrentTool('select'); setShowShapeMenu(false);}} icon={<MousePointer2 size={18}/>} label="Select" />
          <ToolIcon active={currentTool==='pan'} onClick={()=>{setCurrentTool('pan'); setShowShapeMenu(false);}} icon={<Move size={18}/>} label="Pan" />
          <ToolIcon active={currentTool==='brush'} onClick={()=>{setCurrentTool('brush');setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Palette size={18}/>} label="Brush" />
          <ToolIcon active={currentTool==='ai-erase'} onClick={()=>{setCurrentTool('ai-erase');setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Eraser size={18}/>} label="AI Erase" />
          <div className="relative">
            <ToolIcon active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={<ShapeIcon size={18} />} label="Shapes" />
            {showShapeMenu && (
              <div className="absolute left-20 top-0 bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-2xl flex flex-col gap-2 z-[100]">
                <button onClick={() => { setCurrentTool('rect'); setLastUsedShape('rect'); setShowShapeMenu(false); }} className={`p-3 rounded-lg ${currentTool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Square size={18} /></button>
                <button onClick={() => { setCurrentTool('circle'); setLastUsedShape('circle'); setShowShapeMenu(false); }} className={`p-3 rounded-lg ${currentTool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Circle size={18} /></button>
                <button onClick={() => { setCurrentTool('line'); setLastUsedShape('line'); setShowShapeMenu(false); }} className={`p-3 rounded-lg ${currentTool === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Minus size={18} /></button>
              </div>
            )}
          </div>
          <ToolIcon active={currentTool==='text'} onClick={()=>{setCurrentTool('text');setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Type size={18}/>} label="Text" />
          <ToolIcon active={currentTool==='select-fill'} onClick={()=>{setCurrentTool('select-fill');setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<PaintBucket size={18}/>} label="Fill" />
          <ToolIcon active={currentTool==='crop'} onClick={()=>{setCurrentTool('crop');setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Scissors size={18}/>} label="Crop" />
        </div>

        {/* Property Bar */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl min-w-[600px] z-50">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <span className="text-[8px] font-black text-slate-500 uppercase text-center block">Stroke</span>
              <input type="color" value={strokeColor} onChange={e=>setStrokeColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-slate-800" />
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-slate-500 uppercase text-center block">Fill</span>
              <input type="color" value={fillColor} onChange={e=>setFillColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-slate-800" />
            </div>
          </div>
          <div className="w-px h-8 bg-slate-800"></div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase">
              <span>{currentTool==='text'?'Font Size':'Brush Size'}</span>
              <span>{currentTool==='text'?fontSize:strokeWidth}px</span>
            </div>
            <input type="range" min="1" max="150" value={currentTool==='text'?fontSize:strokeWidth} onChange={e=>{const v=parseInt(e.target.value); if(currentTool==='text')setFontSize(v); else setStrokeWidth(v)}} className="w-full h-1 bg-slate-800 appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase"><span>Opacity</span><span>{Math.round(opacity*100)}%</span></div>
            <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={e=>setOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none cursor-pointer accent-indigo-500" />
          </div>
          {currentTool === 'ai-erase' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
               <Sparkles size={14} className="text-indigo-500 animate-pulse" />
               <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Generative Mode</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes snake {
          from { stroke-dashoffset: ${perimeter}; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 group transition-all shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 border border-indigo-500/50 shadow-lg' : 'hover:bg-slate-800'}`}>{icon}</div>
    <span className="text-[7px] font-black uppercase tracking-tighter opacity-60 group-hover:opacity-100">{label}</span>
  </button>
);
const ShapeIcon = ({ size, type }: any) => {
  if (type === 'rect') return <Square size={size} />;
  if (type === 'circle') return <Circle size={size} />;
  return <Minus size={size} />;
};
