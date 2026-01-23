
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Wand2, Loader2, MousePointer2, Maximize, 
  Type, Square, Circle, Minus, Palette, ZoomIn, ZoomOut, Move, Maximize2
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

interface SelectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

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
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const [history, setHistory] = useState<EditorState[]>([]);

  const selectedObject = objects.find(o => o.id === selectedObjectId);
  const isEditingText = selectedObject?.type === 'text' || (currentTool === 'text' && !selectedObject);

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
      } catch (err) {
        setIsProcessing(false);
      }
    };
    initCanvas();
  }, [imageUrl]);

  const saveToHistory = useCallback((currentObjects?: EditorObject[]) => {
    if (canvasRef.current) {
      setHistory(prev => [...prev.slice(-30), { canvasData: canvasRef.current!.toDataURL('image/png'), objects: currentObjects ? [...currentObjects] : [...objects] }]);
    }
  }, [objects]);

  // 标准化核心逻辑：将当前画布转为 1600x1600
  const handleStandardize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 先绘制所有矢量对象到画布，再统一缩放
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
      ctx.lineCap = 'round';
      if (obj.type === 'rect') { ctx.beginPath(); ctx.rect(obj.x, obj.y, obj.width, obj.height); ctx.fill(); ctx.stroke(); }
      else if (obj.type === 'circle') { const r = Math.sqrt(obj.width * obj.width + obj.height * obj.height) / 2; ctx.beginPath(); ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else if (obj.type === 'line') { ctx.beginPath(); ctx.moveTo(obj.x, obj.y); ctx.lineTo(obj.x + obj.width, obj.y + obj.height); ctx.stroke(); }
      else if (obj.type === 'text' && obj.text) { ctx.font = `bold ${obj.fontSize || 40}px Inter, sans-serif`; ctx.fillText(obj.text, obj.x, obj.y + obj.height); if (obj.stroke !== 'transparent' && obj.strokeWidth > 0) ctx.strokeText(obj.text, obj.x, obj.y + obj.height); }
      ctx.restore();
    });
    setObjects([]);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1600;
    tempCanvas.height = 1600;
    const tCtx = tempCanvas.getContext('2d')!;
    
    tCtx.fillStyle = '#FFFFFF';
    tCtx.fillRect(0, 0, 1600, 1600);
    
    const scale = Math.min(1500 / canvas.width, 1500 / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const x = (1600 - w) / 2;
    const y = (1600 - h) / 2;
    
    tCtx.drawImage(canvas, x, y, w, h);
    
    canvas.width = 1600;
    canvas.height = 1600;
    ctx.clearRect(0, 0, 1600, 1600);
    ctx.drawImage(tempCanvas, 0, 0);
    
    if (containerRef.current) {
      const s = Math.min((containerRef.current.clientWidth - 100) / 1600, (containerRef.current.clientHeight - 100) / 1600, 1);
      setZoom(s);
      setPan({ x: 0, y: 0 });
    }
    
    saveToHistory([]);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    const newZoom = Math.min(Math.max(0.05, zoom * delta), 10);
    setZoom(newZoom);
  };

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const hit = objects.slice().reverse().find(obj => pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height );

    if (currentTool === 'pan' || (currentTool === 'select' && !hit && !selectedObjectId)) {
      setIsPanning(true);
      setLastPanPos({ x: clientX, y: clientY });
      return;
    }

    setStartPos(pos);
    if (currentTool === 'select') {
      if (selectedObjectId) {
        const obj = objects.find(o => o.id === selectedObjectId);
        if (obj) {
          const handleSize = 12 / zoom;
          const rotateHandleY = obj.y - 30 / zoom;
          const centerX = obj.x + obj.width / 2;
          if (Math.sqrt(Math.pow(pos.x - centerX, 2) + Math.pow(pos.y - rotateHandleY, 2)) < handleSize) { setIsRotating(true); return; }
          if (pos.x >= obj.x + obj.width - handleSize && pos.x <= obj.x + obj.width + handleSize && pos.y >= obj.y + obj.height - handleSize && pos.y <= obj.y + obj.height + handleSize) { setIsResizing(true); return; }
          if (pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height) { setIsDragging(true); setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y }); return; }
        }
      }
      if (hit) { setSelectedObjectId(hit.id); setIsDragging(true); setDragOffset({ x: pos.x - hit.x, y: pos.y - hit.y }); } 
      else { setSelectedObjectId(null); }
      return;
    }

    setIsDrawing(true);
    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) { setSelection({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }); }
    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineCap = 'round'; ctx.strokeStyle = currentTool === 'ai-erase' ? 'rgba(255, 0, 0, 0.6)' : strokeColor; ctx.lineWidth = strokeWidth; ctx.globalAlpha = opacity; }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    if (isPanning) { const dx = clientX - lastPanPos.x; const dy = clientY - lastPanPos.y; setPan(prev => ({ x: prev.x + dx, y: prev.y + dy })); setLastPanPos({ x: clientX, y: clientY }); return; }
    const pos = getMousePos(e);
    if (currentTool === 'select' && selectedObjectId) {
      const obj = objects.find(o => o.id === selectedObjectId);
      if (!obj) return;
      if (isDragging) { setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : o)); } 
      else if (isResizing) { setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, width: Math.max(10, pos.x - o.x), height: Math.max(10, pos.y - o.y) } : o)); } 
      else if (isRotating) { const centerX = obj.x + obj.width / 2; const centerY = obj.y + obj.height / 2; setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, rotation: Math.atan2(pos.y - centerY, pos.x - centerX) + Math.PI / 2 } : o)); }
      return;
    }
    if (!isDrawing) return;
    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) { setSelection(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null); } 
    else if (currentTool === 'brush' || currentTool === 'ai-erase') { const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); } }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (currentTool === 'select') { if (isDragging || isResizing || isRotating) saveToHistory(objects); setIsDragging(false); setIsResizing(false); setIsRotating(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    const pos = getMousePos(e);
    if (currentTool === 'select-fill') {
      const x = Math.min(startPos.x, pos.x); const y = Math.min(startPos.y, pos.y); const w = Math.abs(startPos.x - pos.x); const h = Math.abs(startPos.y - pos.y);
      if (w > 2 && h > 2) { const newObj: EditorObject = { id: crypto.randomUUID(), type: 'rect', x, y, width: w, height: h, rotation: 0, stroke: 'transparent', fill: fillColor, strokeWidth: 0, opacity: opacity }; const nextObjects = [...objects, newObj]; setObjects(nextObjects); saveToHistory(nextObjects); }
      setSelection(null); return;
    }
    if (['rect', 'circle', 'line'].includes(currentTool)) {
      const newObj: EditorObject = { id: crypto.randomUUID(), type: currentTool as any, x: Math.min(startPos.x, pos.x), y: Math.min(startPos.y, pos.y), width: Math.abs(startPos.x - pos.x), height: Math.abs(startPos.y - pos.y), rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: strokeWidth, opacity: opacity };
      const nextObjects = [...objects, newObj]; setObjects(nextObjects); setSelectedObjectId(newObj.id); setCurrentTool('select'); setSelection(null); saveToHistory(nextObjects);
    } else if (currentTool === 'text') {
      const text = window.prompt(uiLang === 'zh' ? "输入文字:" : "Enter text:");
      if (text) {
        const newObj: EditorObject = { id: crypto.randomUUID(), type: 'text', x: pos.x, y: pos.y, width: text.length * fontSize * 0.6, height: fontSize, rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: 1, fontSize: fontSize, opacity: opacity, text: text };
        const nextObjects = [...objects, newObj]; setObjects(nextObjects); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory(nextObjects);
      }
    } else if (currentTool === 'brush') { saveToHistory(); }
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const prevState = newHistory[newHistory.length - 1];
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && prevState) {
      const img = new Image();
      img.src = prevState.canvasData;
      img.onload = () => { ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); ctx.drawImage(img, 0, 0); setObjects(prevState.objects); setHistory(newHistory); };
    }
  };

  const handleFinalSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsProcessing(true);

    objects.forEach(obj => {
      ctx.save();
      const cx = obj.x + obj.width / 2; const cy = obj.y + obj.height / 2;
      ctx.translate(cx, cy); ctx.rotate(obj.rotation); ctx.translate(-cx, -cy);
      ctx.globalAlpha = obj.opacity; ctx.strokeStyle = obj.stroke; ctx.fillStyle = obj.fill; ctx.lineWidth = obj.strokeWidth; ctx.lineCap = 'round';
      if (obj.type === 'rect') { ctx.beginPath(); ctx.rect(obj.x, obj.y, obj.width, obj.height); ctx.fill(); ctx.stroke(); } 
      else if (obj.type === 'circle') { const r = Math.sqrt(obj.width * obj.width + obj.height * obj.height) / 2; ctx.beginPath(); ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } 
      else if (obj.type === 'line') { ctx.beginPath(); ctx.moveTo(obj.x, obj.y); ctx.lineTo(obj.x + obj.width, obj.y + obj.height); ctx.stroke(); } 
      else if (obj.type === 'text' && obj.text) { ctx.font = `bold ${obj.fontSize || 40}px Inter, sans-serif`; ctx.fillText(obj.text, obj.x, obj.y + obj.height); if (obj.stroke !== 'transparent' && obj.strokeWidth > 0) ctx.strokeText(obj.text, obj.x, obj.y + obj.height); }
      ctx.restore();
    });

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const fd = new FormData();
        fd.append('file', new File([blob], `edit_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
        const data = await res.json();
        const url = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
        if (url) onSave(url);
      } catch (err) { alert("Upload failed"); } finally { setIsProcessing(false); }
    }, 'image/jpeg', 0.95);
  };

  const ShapeIcon = lastUsedShape === 'rect' ? Square : lastUsedShape === 'circle' ? Circle : Minus;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-inter overflow-hidden">
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shadow-xl z-50">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"><X size={20} /></button>
          <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">AI Media Lab</h2>
        </div>

        <div className="flex items-center gap-4">
          {/* 标准化按钮 - 恢复 */}
          <button 
            onClick={handleStandardize}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Maximize2 size={14} className="text-blue-400" /> Standardize 1600px
          </button>

          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setZoom(prev => Math.max(0.05, prev - 0.1))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ZoomOut size={16} /></button>
            <span className="px-3 flex items-center text-[10px] font-black text-slate-300 w-16 justify-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => setZoom(prev => Math.min(10, prev + 0.1))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ZoomIn size={16} /></button>
          </div>
          <button onClick={undo} disabled={history.length <= 1} className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300"><Undo size={18} /></button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transform active:scale-95 transition-all">
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save & Apply
          </button>
        </div>
      </div>

      <div ref={containerRef} onWheel={handleWheel} className="flex-1 bg-slate-950 relative overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="absolute origin-center transition-transform duration-75" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, top: '50%', left: '50%', marginTop: canvasRef.current ? -canvasRef.current.height / 2 : 0, marginLeft: canvasRef.current ? -canvasRef.current.width / 2 : 0 }}>
          <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white">
            <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} className="block" style={{ cursor: currentTool === 'pan' ? 'grab' : currentTool === 'select' ? 'default' : 'crosshair' }} />
            <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox={`0 0 ${canvasRef.current?.width || 0} ${canvasRef.current?.height || 0}`}>
              {isDrawing && selection && ['rect', 'circle', 'line', 'select-fill'].includes(currentTool) && (
                <g opacity={opacity}>
                  {['rect', 'select-fill'].includes(currentTool) && <rect x={Math.min(selection.x1, selection.x2)} y={Math.min(selection.y1, selection.y2)} width={Math.abs(selection.x1 - selection.x2)} height={Math.abs(selection.y1 - selection.y2)} stroke={currentTool === 'select-fill' ? '#fff' : strokeColor} fill={fillColor} strokeWidth={currentTool === 'select-fill' ? 1 : strokeWidth} strokeDasharray={currentTool === 'select-fill' ? "5,5" : "none"} />}
                  {currentTool === 'circle' && <ellipse cx={(selection.x1 + selection.x2) / 2} cy={(selection.y1 + selection.y2) / 2} rx={Math.abs(selection.x1 - selection.x2) / 2} ry={Math.abs(selection.y1 - selection.y2) / 2} stroke={strokeColor} fill={fillColor} strokeWidth={strokeWidth} />}
                  {currentTool === 'line' && <line x1={selection.x1} y1={selection.y1} x2={selection.x2} y2={selection.y2} stroke={strokeColor} strokeWidth={strokeWidth} />}
                </g>
              )}
              {objects.map(obj => (
                <g key={obj.id} transform={`rotate(${(obj.rotation * 180) / Math.PI} ${obj.x + obj.width / 2} ${obj.y + obj.height / 2})`} style={{ opacity: obj.opacity }}>
                  {obj.type === 'rect' && <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} stroke={obj.stroke} fill={obj.fill} strokeWidth={obj.strokeWidth} />}
                  {obj.type === 'circle' && <ellipse cx={obj.x + obj.width/2} cy={obj.y + obj.height/2} rx={obj.width/2} ry={obj.height/2} stroke={obj.stroke} fill={obj.fill} strokeWidth={obj.strokeWidth} />}
                  {obj.type === 'line' && <line x1={obj.x} y1={obj.y} x2={obj.x + obj.width} y2={obj.y + obj.height} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type === 'text' && <text x={obj.x} y={obj.y + obj.height} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} style={{ font: `bold ${obj.fontSize || 40}px Inter, sans-serif` }}>{obj.text}</text>}
                  {selectedObjectId === obj.id && (
                    <>
                      <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} fill="none" stroke="#6366f1" strokeWidth={2 / zoom} strokeDasharray="4" />
                      <circle cx={obj.x + obj.width} cy={obj.y + obj.height} r={6 / zoom} fill="#6366f1" className="cursor-nwse-resize pointer-events-auto" />
                      <line x1={obj.x + obj.width/2} y1={obj.y} x2={obj.x + obj.width/2} y2={obj.y - 30/zoom} stroke="#6366f1" strokeWidth={2/zoom} />
                      <circle cx={obj.x + obj.width/2} cy={obj.y - 30/zoom} r={8 / zoom} fill="#6366f1" className="cursor-pointer pointer-events-auto" />
                    </>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="fixed left-6 top-1/2 -translate-y-1/2 w-16 bg-slate-900/90 backdrop-blur-xl border border-slate-800 flex flex-col items-center py-6 gap-6 rounded-3xl shadow-2xl z-50">
          <ToolIcon active={currentTool === 'select'} onClick={() => { setCurrentTool('select'); setShowShapeMenu(false); }} icon={<MousePointer2 size={18} />} label="Select" />
          <ToolIcon active={currentTool === 'pan'} onClick={() => { setCurrentTool('pan'); setShowShapeMenu(false); }} icon={<Move size={18} />} label="Pan" />
          <ToolIcon active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelectedObjectId(null); setShowShapeMenu(false); }} icon={<Palette size={18} />} label="Brush" />
          <ToolIcon active={currentTool === 'ai-erase'} onClick={() => { setCurrentTool('ai-erase'); setSelectedObjectId(null); setShowShapeMenu(false); }} icon={<Eraser size={18} />} label="AI Erase" />
          <div className="relative">
            <ToolIcon active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={<ShapeIcon size={18} />} label="Shapes" />
            {showShapeMenu && (
              <div className="absolute left-20 top-0 bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-2xl flex flex-col gap-2 z-[100] animate-in slide-in-from-left-2">
                <button onClick={() => { setCurrentTool('rect'); setLastUsedShape('rect'); setShowShapeMenu(false); }} className={`p-3 rounded-lg hover:bg-indigo-600 ${currentTool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Square size={18} /></button>
                <button onClick={() => { setCurrentTool('circle'); setLastUsedShape('circle'); setShowShapeMenu(false); }} className={`p-3 rounded-lg hover:bg-indigo-600 ${currentTool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Circle size={18} /></button>
                <button onClick={() => { setCurrentTool('line'); setLastUsedShape('line'); setShowShapeMenu(false); }} className={`p-3 rounded-lg hover:bg-indigo-600 ${currentTool === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Minus size={18} /></button>
              </div>
            )}
          </div>
          <ToolIcon active={currentTool === 'text'} onClick={() => { setCurrentTool('text'); setSelectedObjectId(null); setShowShapeMenu(false); }} icon={<Type size={18} />} label="Text" />
          <ToolIcon active={currentTool === 'select-fill'} onClick={() => { setCurrentTool('select-fill'); setSelectedObjectId(null); setShowShapeMenu(false); }} icon={<PaintBucket size={18} />} label="Fill" />
          <ToolIcon active={currentTool === 'crop'} onClick={() => { setCurrentTool('crop'); setSelectedObjectId(null); setShowShapeMenu(false); }} icon={<Scissors size={18} />} label="Crop" />
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl z-50 min-w-[600px]">
           <div className="flex items-center gap-4">
             <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-500 uppercase text-center block">Stroke</span>
               <input type="color" value={strokeColor} onChange={(e) => { setStrokeColor(e.target.value); if(selectedObjectId) setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, stroke: e.target.value } : o)); }} className="w-8 h-8 rounded-lg cursor-pointer bg-slate-800 border border-slate-700" />
             </div>
             <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-500 uppercase text-center block">Fill</span>
               <input type="color" value={fillColor} onChange={(e) => { setFillColor(e.target.value); if(selectedObjectId) setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, fill: e.target.value } : o)); }} className="w-8 h-8 rounded-lg cursor-pointer bg-slate-800 border border-slate-700" />
             </div>
           </div>
           <div className="w-px h-8 bg-slate-800"></div>
           <div className="flex flex-col gap-2 flex-1">
             <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase"><span>{isEditingText ? 'Font Size' : 'Stroke Weight'}</span><span>{isEditingText ? fontSize : strokeWidth}px</span></div>
             <input type="range" min={isEditingText ? 12 : 1} max={isEditingText ? 150 : 50} value={isEditingText ? fontSize : strokeWidth} onChange={(e) => { const v = parseInt(e.target.value); if(isEditingText) { setFontSize(v); if(selectedObject?.type === 'text') setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, fontSize: v, width: (o.text?.length || 1) * v * 0.6, height: v } : o)); } else { setStrokeWidth(v); if(selectedObject && selectedObject.type !== 'text') setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, strokeWidth: v } : o)); } }} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
           </div>
           <div className="flex flex-col gap-2 flex-1">
             <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase"><span>Opacity</span><span>{Math.round(opacity * 100)}%</span></div>
             <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e) => { const v = parseFloat(e.target.value); setOpacity(v); if(selectedObjectId) setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, opacity: v } : o)); }} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
           </div>
           {currentTool === 'ai-erase' && (
             <button onClick={async () => {
                setIsProcessing(true); try {
                  const base64 = canvasRef.current!.toDataURL('image/jpeg', 0.9).split(',')[1];
                  const result = await editImageWithAI(base64, "Erase red areas.");
                  const img = new Image(); img.src = `data:image/jpeg;base64,${result}`;
                  img.onload = () => { const ctx = canvasRef.current!.getContext('2d')!; ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); ctx.drawImage(img, 0, 0); saveToHistory(); setIsProcessing(false); };
                } catch (e) { setIsProcessing(false); }
             }} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black shadow-xl flex items-center gap-2"><Wand2 size={14} /> AI ERASE</button>
           )}
        </div>
        {isProcessing && <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md"><Loader2 size={40} className="text-indigo-500 animate-spin" /><p className="mt-8 text-white font-black tracking-[0.3em] text-sm uppercase">Processing...</p></div>}
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
