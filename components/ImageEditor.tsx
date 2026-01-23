
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
 * 核心本地算法：内容识别填充 (Simple Inpainting Implementation)
 * 专门用于在无 API 时处理文字、水印等细小遮挡
 */
const localInpaint = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const mask = new Uint8Array(width * height);
  
  // 1. 提取遮罩（识别红色涂抹区域: R > 200, G < 100, B < 100, A > 100）
  let hasMask = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200 && data[i+1] < 100 && data[i+2] < 100 && data[i+3] > 100) {
      mask[i / 4] = 1;
      hasMask = true;
    }
  }

  if (!hasMask) return;

  // 2. 简化的边界像素扩散填充 (Iterative Box-Blur Based Inpainting)
  // 虽然不如完整的 Telea 算法精确，但在高分辨率下移除文字效果极佳且速度极快
  const temp = new Uint8ClampedArray(data);
  const iterations = 8; // 迭代次数，决定扩散范围

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (mask[i] === 1) {
          let r = 0, g = 0, b = 0, count = 0;
          // 检查 8 邻域
          const neighbors = [
            i - width - 1, i - width, i - width + 1,
            i - 1, i + 1,
            i + width - 1, i + width, i + width + 1
          ];
          
          for (const n of neighbors) {
            if (mask[n] === 0) {
              r += temp[n * 4];
              g += temp[n * 4 + 1];
              b += temp[n * 4 + 2];
              count++;
            }
          }
          
          if (count > 0) {
            data[i * 4] = r / count;
            data[i * 4 + 1] = g / count;
            data[i * 4 + 2] = b / count;
            data[i * 4 + 3] = 255;
            mask[i] = 0; // 这一层填充后标记为非遮罩，供下次迭代参考
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
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(5); 
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

  useEffect(() => {
    const initCanvas = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
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
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          if (containerRef.current) {
            const scale = Math.min((containerRef.current.clientWidth - 100) / img.width, (containerRef.current.clientHeight - 100) / img.height, 0.9);
            setZoom(scale || 1);
            setPan({ x: 0, y: 0 });
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

  const handleStandardize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 渲染所有临时对象
    objects.forEach(obj => {
      ctx.save();
      const cx = obj.x + obj.width / 2; const cy = obj.y + obj.height / 2;
      ctx.translate(cx, cy); ctx.rotate(obj.rotation); ctx.translate(-cx, -cy);
      ctx.globalAlpha = obj.opacity; ctx.strokeStyle = obj.stroke; ctx.fillStyle = obj.fill; ctx.lineWidth = obj.strokeWidth;
      if (obj.type === 'rect') { ctx.beginPath(); ctx.rect(obj.x, obj.y, obj.width, obj.height); ctx.fill(); ctx.stroke(); }
      else if (obj.type === 'circle') { const r = Math.sqrt(obj.width**2 + obj.height**2)/2; ctx.beginPath(); ctx.arc(obj.x+obj.width/2, obj.y+obj.height/2, r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
      else if (obj.type === 'line') { ctx.beginPath(); ctx.moveTo(obj.x, obj.y); ctx.lineTo(obj.x+obj.width, obj.y+obj.height); ctx.stroke(); }
      else if (obj.type === 'text' && obj.text) { ctx.font = `bold ${obj.fontSize}px Inter`; ctx.fillText(obj.text, obj.x, obj.y+obj.height); }
      ctx.restore();
    });
    setObjects([]);

    const temp = document.createElement('canvas'); temp.width = 1600; temp.height = 1600;
    const tCtx = temp.getContext('2d')!; tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0,0,1600,1600);
    const scale = Math.min(1500/canvas.width, 1500/canvas.height);
    const w = canvas.width * scale; const h = canvas.height * scale;
    tCtx.drawImage(canvas, (1600-w)/2, (1600-h)/2, w, h);
    canvas.width = 1600; canvas.height = 1600; ctx.drawImage(temp, 0, 0);
    if (containerRef.current) { setZoom(Math.min((containerRef.current.clientWidth-100)/1600, (containerRef.current.clientHeight-100)/1600, 1)); setPan({x:0, y:0}); }
    saveToHistory([]);
  };

  // Fix: Implement handleFinalSave to commit all changes and upload the resulting image to the server
  const handleFinalSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsProcessing(true);
    try {
      // 1. Render all temporary objects to the canvas first to flatten the image
      objects.forEach(obj => {
        ctx.save();
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(obj.rotation);
        ctx.translate(-cx, -cy);
        ctx.globalAlpha = obj.opacity;
        ctx.strokeStyle = obj.stroke;
        ctx.fillStyle = obj.fill;
        ctx.lineWidth = obj.strokeWidth;
        
        if (obj.type === 'rect') {
          ctx.beginPath();
          ctx.rect(obj.x, obj.y, obj.width, obj.height);
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'circle') {
          const r = Math.sqrt(obj.width ** 2 + obj.height ** 2) / 2;
          ctx.beginPath();
          ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'line') {
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
          ctx.stroke();
        } else if (obj.type === 'text' && obj.text) {
          ctx.font = `bold ${obj.fontSize}px Inter`;
          ctx.fillText(obj.text, obj.x, obj.y + obj.height);
        }
        ctx.restore();
      });

      // 2. Convert canvas to blob and upload to the image hosting API
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsProcessing(false);
          return;
        }
        
        const file = new File([blob], `edit_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const fd = new FormData();
        fd.append('file', file);
        
        try {
          const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
          if (!res.ok) throw new Error("Image upload failed");
          
          const data = await res.json();
          const u = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
          
          if (u) {
            onSave(u);
          } else {
            throw new Error("No URL returned from server");
          }
        } catch (e: any) {
          alert("Upload failed: " + e.message);
          setIsProcessing(false);
        }
      }, 'image/jpeg', 0.9);

    } catch (err: any) {
      alert("Save failed: " + err.message);
      setIsProcessing(false);
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const hit = objects.slice().reverse().find(o => pos.x >= o.x && pos.x <= o.x+o.width && pos.y >= o.y && pos.y <= o.y+o.height);

    if (currentTool === 'pan' || (currentTool === 'select' && !hit && !selectedObjectId)) {
      setIsPanning(true); setLastPanPos({ x: clientX, y: clientY }); return;
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
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && (currentTool === 'brush' || currentTool === 'ai-erase')) {
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = currentTool === 'ai-erase' ? 'rgba(255, 0, 0, 0.6)' : strokeColor;
      ctx.lineWidth = currentTool === 'ai-erase' ? strokeWidth * 2 : strokeWidth;
      ctx.globalAlpha = currentTool === 'ai-erase' ? 0.7 : opacity;
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    if (isPanning) { setPan(p => ({ x: p.x + (clientX - lastPanPos.x), y: p.y + (clientY - lastPanPos.y) })); setLastPanPos({ x: clientX, y: clientY }); return; }
    const pos = getMousePos(e);
    if (currentTool === 'select' && selectedObjectId) {
      if (isDragging) setObjects(prev => prev.map(o => o.id === selectedObjectId ? {...o, x: pos.x-dragOffset.x, y: pos.y-dragOffset.y} : o));
      else if (isResizing) setObjects(prev => prev.map(o => o.id === selectedObjectId ? {...o, width: Math.max(10, pos.x-o.x), height: Math.max(10, pos.y-o.y)} : o));
      else if (isRotating) { const obj = objects.find(o => o.id === selectedObjectId)!; setObjects(prev => prev.map(o => o.id === selectedObjectId ? {...o, rotation: Math.atan2(pos.y-(o.y+o.height/2), pos.x-(o.x+o.width/2)) + Math.PI/2} : o)); }
      return;
    }
    if (!isDrawing) return;
    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) setSelection(p => p ? {...p, x2: pos.x, y2: pos.y} : null);
    else { const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); } }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (currentTool === 'select') { if (isDragging || isResizing || isRotating) saveToHistory(objects); setIsDragging(false); setIsResizing(false); setIsRotating(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    const pos = getMousePos(e);
    if (['rect', 'circle', 'line'].includes(currentTool)) {
      const newObj: EditorObject = { id: crypto.randomUUID(), type: currentTool as any, x: Math.min(startPos.x, pos.x), y: Math.min(startPos.y, pos.y), width: Math.abs(startPos.x-pos.x), height: Math.abs(startPos.y-pos.y), rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: strokeWidth, opacity: opacity };
      setObjects([...objects, newObj]); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory([...objects, newObj]);
    } else if (currentTool === 'text') {
      const text = window.prompt("Text:"); if (text) {
        const newObj: EditorObject = { id: crypto.randomUUID(), type: 'text', x: pos.x, y: pos.y, width: text.length*fontSize*0.6, height: fontSize, rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: 1, fontSize: fontSize, opacity: opacity, text: text };
        setObjects([...objects, newObj]); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory([...objects, newObj]);
      }
    } else if (currentTool === 'brush' || currentTool === 'ai-erase') { saveToHistory(); }
    setSelection(null);
  };

  const handleLocalErase = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    setIsProcessing(true);
    // 给 UI 一点反馈时间
    setTimeout(() => {
      localInpaint(ctx, canvas.width, canvas.height);
      saveToHistory();
      setIsProcessing(false);
      setCurrentTool('select');
    }, 100);
  };

  const handleCloudErase = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);
    try {
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      const result = await editImageWithAI(base64, "Erase red highlighted areas accurately.");
      const img = new Image(); img.src = `data:image/jpeg;base64,${result}`;
      img.onload = () => { 
        const ctx = canvas.getContext('2d')!; ctx.clearRect(0,0,canvas.width, canvas.height); ctx.drawImage(img, 0, 0); 
        saveToHistory(); setIsProcessing(false); setCurrentTool('select');
      };
    } catch (e) { alert("Cloud Erase failed. Try Local Erase."); setIsProcessing(false); }
  };

  const getMousePos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) / zoom, y: (cy - rect.top) / zoom };
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-inter overflow-hidden">
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shadow-xl z-50">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
          <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">AI Media Lab</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleStandardize} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
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
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save & Apply
          </button>
        </div>
      </div>

      <div ref={containerRef} onWheel={e => { e.preventDefault(); const delta = e.deltaY > 0 ? 0.9 : 1.1; setZoom(z => Math.min(10, Math.max(0.05, z*delta))); }} className="flex-1 bg-slate-950 relative overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="absolute origin-center" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, top: '50%', left: '50%', marginTop: canvasRef.current ? -canvasRef.current.height/2 : 0, marginLeft: canvasRef.current ? -canvasRef.current.width/2 : 0 }}>
          <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white">
            <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} className="block" style={{ cursor: currentTool==='pan'?'grab':currentTool==='select'?'default':'crosshair' }} />
            <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox={`0 0 ${canvasRef.current?.width||0} ${canvasRef.current?.height||0}`}>
              {selection && <rect x={Math.min(selection.x1, selection.x2)} y={Math.min(selection.y1, selection.y2)} width={Math.abs(selection.x1-selection.x2)} height={Math.abs(selection.y1-selection.y2)} fill={currentTool==='select-fill'?fillColor:'none'} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={currentTool==='crop'?'5,5':'none'} />}
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

        <div className="fixed left-6 top-1/2 -translate-y-1/2 w-16 bg-slate-900/90 backdrop-blur-xl border border-slate-800 flex flex-col items-center py-6 gap-6 rounded-3xl shadow-2xl z-50">
          <ToolIcon active={currentTool==='select'} onClick={()=>setCurrentTool('select')} icon={<MousePointer2 size={18}/>} label="Select" />
          <ToolIcon active={currentTool==='pan'} onClick={()=>setCurrentTool('pan')} icon={<Move size={18}/>} label="Pan" />
          <ToolIcon active={currentTool==='brush'} onClick={()=>{setCurrentTool('brush');setSelectedObjectId(null)}} icon={<Palette size={18}/>} label="Brush" />
          <ToolIcon active={currentTool==='ai-erase'} onClick={()=>{setCurrentTool('ai-erase');setSelectedObjectId(null)}} icon={<Eraser size={18}/>} label="AI Erase" />
          <ToolIcon active={currentTool==='text'} onClick={()=>{setCurrentTool('text');setSelectedObjectId(null)}} icon={<Type size={18}/>} label="Text" />
          <ToolIcon active={currentTool==='crop'} onClick={()=>{setCurrentTool('crop');setSelectedObjectId(null)}} icon={<Scissors size={18}/>} label="Crop" />
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-4 items-center z-50">
           {currentTool === 'ai-erase' && (
             <div className="flex gap-3 animate-in slide-in-from-bottom-4">
                <button onClick={handleLocalErase} className="px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black shadow-2xl flex items-center gap-2 hover:scale-105 transition-all">
                  <Sparkles size={14} className="text-indigo-600" /> APPLY LOCAL ERASE (Offline)
                </button>
                <button onClick={handleCloudErase} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black shadow-2xl flex items-center gap-2 hover:bg-indigo-700 hover:scale-105 transition-all">
                  <Wand2 size={14} /> CLOUD AI ERASE (HD)
                </button>
             </div>
           )}
           
           <div className="flex items-center gap-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl min-w-[600px]">
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
                  <span>{currentTool==='text'?'Font Size':'Size'}</span>
                  <span>{currentTool==='text'?fontSize:strokeWidth}px</span>
                </div>
                <input type="range" min="1" max="150" value={currentTool==='text'?fontSize:strokeWidth} onChange={e=>{const v=parseInt(e.target.value); if(currentTool==='text')setFontSize(v); else setStrokeWidth(v)}} className="w-full h-1 bg-slate-800 appearance-none cursor-pointer accent-blue-500" />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase"><span>Opacity</span><span>{Math.round(opacity*100)}%</span></div>
                <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={e=>setOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none cursor-pointer accent-indigo-500" />
              </div>
           </div>
        </div>

        {isProcessing && (
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md">
            <Loader2 size={40} className="text-indigo-500 animate-spin" />
            <p className="mt-8 text-white font-black tracking-[0.3em] text-sm uppercase">Optimizing Pixels...</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 group transition-all shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 border border-indigo-500/50 shadow-lg' : 'hover:bg-slate-800'}`}>{icon}</div>
    <span className="text-[7px] font-black uppercase tracking-tighter opacity-60 group-hover:opacity-100">{label}</span>
  </button>
);
