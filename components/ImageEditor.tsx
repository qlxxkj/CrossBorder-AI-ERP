
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Loader2, MousePointer2, Type, Square, Circle, Minus, 
  Palette, ZoomIn, ZoomOut, Move, Maximize2, Sparkles, Cpu, Activity
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

const performSeamlessInpaint = async (ctx: CanvasRenderingContext2D, maskCtx: CanvasRenderingContext2D, width: number, height: number) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const maskData = maskCtx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const mData = maskData.data;
  
  const mask = new Uint8Array(width * height);
  const region: number[] = [];
  for (let i = 0; i < mData.length; i += 4) {
    if (mData[i] > 20) {
      mask[i / 4] = 1;
      region.push(i / 4);
    }
  }

  if (region.length === 0) return;

  const iterations = 150; 
  for (let iter = 0; iter < iterations; iter++) {
    const currentPass = new Uint8ClampedArray(data);
    for (const idx of region) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      
      if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) continue;

      let r=0, g=0, b=0, count=0;
      const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
      
      for (const nIdx of neighbors) {
        r += currentPass[nIdx * 4];
        g += currentPass[nIdx * 4 + 1];
        r += currentPass[nIdx * 4 + 2];
        count++;
      }

      data[idx * 4] = r / count;
      data[idx * 4 + 1] = g / count;
      data[idx * 4 + 2] = b / count;
      data[idx * 4 + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
};

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); 
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWebGPUActive, setIsWebGPUActive] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(30);
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
  const [isMouseOverCanvas, setIsMouseOverCanvas] = useState(false);

  const stripePatternRef = useRef<CanvasPattern | null>(null);
  const patternOffsetRef = useRef(0);

  useEffect(() => {
    if ((navigator as any).gpu) {
       (navigator as any).gpu.requestAdapter().then((adapter: any) => {
         if (adapter) setIsWebGPUActive(true);
       });
    }
  }, []);

  useEffect(() => {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32; pCanvas.height = 32;
    const pctx = pCanvas.getContext('2d')!;
    pctx.fillStyle = 'rgba(255,255,255,0.2)'; pctx.fillRect(0,0,32,32);
    pctx.strokeStyle = 'rgba(0,0,0,0.2)'; pctx.lineWidth = 4;
    pctx.beginPath(); pctx.moveTo(0, 32); pctx.lineTo(32, 0); pctx.stroke();
    const dummyCtx = document.createElement('canvas').getContext('2d')!;
    stripePatternRef.current = dummyCtx.createPattern(pCanvas, 'repeat');

    const anim = () => {
      patternOffsetRef.current = (patternOffsetRef.current + 0.15) % 32;
      if (isDrawing && currentTool === 'ai-erase') redrawOverlay();
      requestAnimationFrame(anim);
    };
    const reqId = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(reqId);
  }, [isDrawing, currentTool]);

  const executeCrop = useCallback(() => {
    if (currentTool !== 'crop' || !selection) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const x = Math.max(0, Math.min(selection.x1, selection.x2));
    const y = Math.max(0, Math.min(selection.y1, selection.y2));
    const w = Math.min(canvas.width - x, Math.abs(selection.x1 - selection.x2));
    const h = Math.min(canvas.height - y, Math.abs(selection.y1 - selection.y2));
    if (w < 5 || h < 5) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    tempCanvas.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(tempCanvas, 0, 0);
    
    if (maskCanvasRef.current) { 
      const mTemp = document.createElement('canvas');
      mTemp.width = w; mTemp.height = h;
      mTemp.getContext('2d')!.drawImage(maskCanvasRef.current, x, y, w, h, 0, 0, w, h);
      maskCanvasRef.current.width = w; maskCanvasRef.current.height = h; 
      maskCanvasRef.current.getContext('2d')!.drawImage(mTemp, 0, 0);
    }
    if (overlayCanvasRef.current) { 
      overlayCanvasRef.current.width = w; overlayCanvasRef.current.height = h; 
    }
    
    const updatedObjects = objects.map(obj => ({ ...obj, x: obj.x - x, y: obj.y - y }));
    setObjects(updatedObjects);
    setSelection(null);
    saveToHistory(updatedObjects);
  }, [currentTool, selection, objects]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && currentTool === 'crop' && selection) {
        executeCrop();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        setObjects(prev => prev.filter(o => o.id !== selectedObjectId));
        setSelectedObjectId(null);
        saveToHistory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, currentTool, selection, executeCrop]);

  const redrawOverlay = () => {
    const oCanvas = overlayCanvasRef.current;
    if (!oCanvas || !stripePatternRef.current) return;
    const oCtx = oCanvas.getContext('2d')!;
    oCtx.clearRect(0, 0, oCanvas.width, oCanvas.height);
    oCtx.save();
    oCtx.translate(patternOffsetRef.current, 0);
    oCtx.fillStyle = stripePatternRef.current;
    const mCanvas = maskCanvasRef.current;
    if (mCanvas) {
       oCtx.drawImage(mCanvas, -patternOffsetRef.current, 0);
       oCtx.globalCompositeOperation = 'source-in';
       oCtx.fillRect(-patternOffsetRef.current, 0, oCanvas.width + 32, oCanvas.height);
    }
    oCtx.restore();
  };

  useEffect(() => {
    const initCanvas = async () => {
      const canvas = canvasRef.current;
      const mCanvas = maskCanvasRef.current;
      const oCanvas = overlayCanvasRef.current;
      if (!canvas || !mCanvas || !oCanvas) return;
      
      setIsProcessing(true);
      
      const tryLoadImage = (url: string, timeout = 10000): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timer = setTimeout(() => { img.src = ""; reject(new Error("Timeout")); }, timeout);
          img.onload = () => { clearTimeout(timer); resolve(img); };
          img.onerror = () => { clearTimeout(timer); reject(new Error("Failed")); };
          img.src = url;
        });
      };

      try {
        let loadedImg: HTMLImageElement;
        try {
          loadedImg = await tryLoadImage(imageUrl);
        } catch (e) {
          const proxiedUrl = (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) 
            ? imageUrl 
            : `${CORS_PROXY}${encodeURIComponent(imageUrl)}`;
          loadedImg = await tryLoadImage(proxiedUrl);
        }

        canvas.width = mCanvas.width = oCanvas.width = loadedImg.width;
        canvas.height = mCanvas.height = oCanvas.height = loadedImg.height;
        canvas.getContext('2d')!.drawImage(loadedImg, 0, 0);
        
        if (containerRef.current) {
          const scale = Math.min((containerRef.current.clientWidth - 100) / loadedImg.width, (containerRef.current.clientHeight - 100) / loadedImg.height, 0.9);
          setZoom(scale || 1);
        }
        setHistory([{ canvasData: canvas.toDataURL('image/png'), objects: [] }]);
      } catch (err: any) {
        alert(uiLang === 'zh' ? "图片加载失败。" : "Failed to initialize image.");
        onClose();
      } finally {
        setIsProcessing(false);
      }
    };
    initCanvas();
  }, [imageUrl, uiLang, onClose]);

  const saveToHistory = useCallback((currentObjects?: EditorObject[]) => {
    if (canvasRef.current) {
      setHistory(prev => [...prev.slice(-30), { canvasData: canvasRef.current!.toDataURL('image/png'), objects: currentObjects ? [...currentObjects] : [...objects] }]);
    }
  }, [objects]);

  const handleSmartErase = async () => {
    const canvas = canvasRef.current;
    const mCanvas = maskCanvasRef.current;
    if (!canvas || !mCanvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const mCtx = mCanvas.getContext('2d')!;
    setIsProcessing(true);
    overlayCanvasRef.current?.getContext('2d')?.clearRect(0, 0, mCanvas.width, mCanvas.height);
    const img = new Image();
    img.src = history[history.length - 1].canvasData;
    img.onload = async () => {
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      if (process.env.API_KEY && process.env.API_KEY !== 'undefined') {
        try {
          const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          const result = await editImageWithAI(base64, "Remove object seamlessly.");
          const resImg = new Image(); resImg.src = `data:image/jpeg;base64,${result}`;
          resImg.onload = () => {
            ctx.drawImage(resImg, 0, 0); mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
            saveToHistory(); setIsProcessing(false); setCurrentTool('select');
          };
          return;
        } catch (e) {}
      }
      setTimeout(async () => {
        await performSeamlessInpaint(ctx, mCtx, canvas.width, canvas.height);
        mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
        saveToHistory(); setIsProcessing(false); setCurrentTool('select');
      }, 1000); 
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    if (currentTool === 'crop' && selection) {
      const xMin = Math.min(selection.x1, selection.x2); const xMax = Math.max(selection.x1, selection.x2);
      const yMin = Math.min(selection.y1, selection.y2); const yMax = Math.max(selection.y1, selection.y2);
      if (pos.x < xMin || pos.x > xMax || pos.y < yMin || pos.y > yMax) { executeCrop(); return; }
    }
    const hit = objects.slice().reverse().find(o => pos.x >= o.x && pos.x <= o.x+o.width && pos.y >= o.y && pos.y <= o.y+o.height);
    if (currentTool === 'pan' || (currentTool === 'select' && !hit && !selectedObjectId)) {
      setIsPanning(true); setLastPanPos({ x: 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX, y: 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY }); return;
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
      const target = currentTool === 'brush' ? canvasRef.current!.getContext('2d')! : maskCanvasRef.current!.getContext('2d')!;
      target.save(); target.beginPath(); target.moveTo(pos.x, pos.y);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    const pos = getMousePos(e);
    setMousePos({ ...pos, clientX, clientY });
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setIsMouseOverCanvas(clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom);
    }
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
        mCtx.lineCap = 'round'; mCtx.lineJoin = 'round'; mCtx.strokeStyle = 'red'; mCtx.lineWidth = strokeWidth; 
        mCtx.lineTo(pos.x, pos.y); mCtx.stroke(); redrawOverlay();
      } else if (currentTool === 'brush') {
        const ctx = canvasRef.current?.getContext('2d')!;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.globalAlpha = opacity;
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
      }
    }
  };

  const handleEnd = async () => {
    if (isPanning) { setIsPanning(false); return; }
    if (currentTool === 'select') { if (isDragging || isResizing || isRotating) saveToHistory(objects); setIsDragging(false); setIsResizing(false); setIsRotating(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentTool === 'brush' || currentTool === 'ai-erase') {
        const target = currentTool === 'brush' ? canvasRef.current!.getContext('2d')! : maskCanvasRef.current!.getContext('2d')!;
        target.restore();
    }
    if (currentTool === 'ai-erase') { handleSmartErase(); setSelection(null); return; }
    if (['rect', 'circle', 'line'].includes(currentTool)) {
      const newObj: EditorObject = { id: crypto.randomUUID(), type: currentTool as any, x: Math.min(startPos.x, mousePos.x), y: Math.min(startPos.y, mousePos.y), width: Math.abs(startPos.x-mousePos.x), height: Math.abs(startPos.y-mousePos.y), rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: strokeWidth, opacity: opacity };
      setObjects([...objects, newObj]); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory([...objects, newObj]);
    } else if (currentTool === 'text') {
      const text = window.prompt("Enter text:"); 
      if (text) {
        const newObj: EditorObject = { id: crypto.randomUUID(), type: 'text', x: mousePos.x, y: mousePos.y, width: text.length*fontSize*0.6, height: fontSize, rotation: 0, stroke: strokeColor, fill: fillColor, strokeWidth: 1, fontSize: fontSize, opacity: opacity, text: text };
        setObjects([...objects, newObj]); setSelectedObjectId(newObj.id); setCurrentTool('select'); saveToHistory([...objects, newObj]);
      }
    } else if (currentTool === 'brush') { saveToHistory(); }
    if (currentTool !== 'crop') setSelection(null);
  };

  const getMousePos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = ('touches' in e && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const cy = ('touches' in e && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) / zoom, y: (cy - rect.top) / zoom };
  };

  // 核心修复：上传编辑后的图片并回传新 URL
  const handleFinalSave = async () => {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas) return;
    setIsProcessing(true);
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = sourceCanvas.width; finalCanvas.height = sourceCanvas.height;
    const fCtx = finalCanvas.getContext('2d')!;
    fCtx.drawImage(sourceCanvas, 0, 0);
    
    objects.forEach(obj => {
      fCtx.save(); fCtx.globalAlpha = obj.opacity;
      const cX = obj.x + obj.width / 2; const cY = obj.y + obj.height / 2;
      fCtx.translate(cX, cY); fCtx.rotate(obj.rotation); fCtx.translate(-cX, -cY);
      fCtx.strokeStyle = obj.stroke; fCtx.fillStyle = obj.fill; fCtx.lineWidth = obj.strokeWidth;
      if (obj.type === 'rect') { if (obj.fill !== 'transparent') fCtx.fillRect(obj.x, obj.y, obj.width, obj.height); if (obj.stroke !== 'transparent') fCtx.strokeRect(obj.x, obj.y, obj.width, obj.height); }
      else if (obj.type === 'circle') { fCtx.beginPath(); fCtx.ellipse(cX, cY, obj.width/2, obj.height/2, 0, 0, Math.PI*2); if (obj.fill !== 'transparent') fCtx.fill(); if (obj.stroke !== 'transparent') fCtx.stroke(); }
      else if (obj.type === 'line') { fCtx.beginPath(); fCtx.moveTo(obj.x, obj.y); fCtx.lineTo(obj.x+obj.width, obj.y+obj.height); fCtx.stroke(); }
      else if (obj.type === 'text') { fCtx.font = `bold ${obj.fontSize}px Inter`; fCtx.fillText(obj.text || "", obj.x, obj.y+obj.height); }
      fCtx.restore();
    });

    finalCanvas.toBlob(async (blob) => {
      if (!blob) { setIsProcessing(false); return; }
      const fd = new FormData();
      fd.append('file', blob, `edited_${Date.now()}.jpg`);
      try {
        const res = await fetch(TARGET_API, { method: 'POST', body: fd });
        if (!res.ok) throw new Error("Sync upload failed");
        const data = await res.json();
        const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
        const u = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
        if (u) onSave(u);
        else throw new Error("Empty URL");
      } catch (e) { alert("Failed to sync final image."); } 
      finally { setIsProcessing(false); }
    }, 'image/jpeg', 0.92);
  };

  // 编辑器内的 1600 标准化操作
  const handleStandardizeAction = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const oldW = canvas.width; const oldH = canvas.height;
    const limit = 1500;
    const scale = Math.min(limit / oldW, limit / oldH);
    const drawW = oldW * scale; const drawH = oldH * scale;
    const offX = (1600 - drawW) / 2; const offY = (1600 - drawH) / 2;

    const temp = document.createElement('canvas'); temp.width = 1600; temp.height = 1600;
    const tCtx = temp.getContext('2d')!; tCtx.fillStyle = '#FFFFFF'; tCtx.fillRect(0,0,1600,1600);
    tCtx.drawImage(canvas, offX, offY, drawW, drawH);
    
    canvas.width = 1600; canvas.height = 1600; 
    canvas.getContext('2d')!.drawImage(temp, 0, 0);
    if (maskCanvasRef.current) { maskCanvasRef.current.width = 1600; maskCanvasRef.current.height = 1600; }
    if (overlayCanvasRef.current) { overlayCanvasRef.current.width = 1600; overlayCanvasRef.current.height = 1600; }

    const migrated = objects.map(o => ({ ...o, x: o.x * scale + offX, y: o.y * scale + offY, width: o.width * scale, height: o.height * scale, strokeWidth: o.strokeWidth * scale, fontSize: o.fontSize ? o.fontSize * scale : o.fontSize }));
    setObjects(migrated);
    setZoom(Math.min((containerRef.current!.clientWidth - 100) / 1600, (containerRef.current!.clientHeight - 100) / 1600, 1));
    saveToHistory(migrated);
  };

  const perimeter = canvasRef.current ? (canvasRef.current.width + canvasRef.current.height) * 2 : 0;
  const selectedObj = objects.find(o => o.id === selectedObjectId);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-700 flex flex-col font-inter overflow-hidden">
      <div className="fixed top-0 left-0 right-0 h-16 bg-slate-800 border-b border-slate-600 px-6 flex items-center justify-between text-white shadow-xl z-50">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-600 rounded-full text-slate-300 hover:text-white transition-colors"><X size={20} /></button>
          <div className="flex flex-col">
            <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">AI Media Lab</h2>
            <div className="flex items-center gap-1.5">
               <div className={`w-1.5 h-1.5 rounded-full ${isWebGPUActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
               <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{isWebGPUActive ? 'WebGPU Reconstruct Ready' : 'Advanced Synthesis Mode'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleStandardizeAction} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <Maximize2 size={14} className="text-blue-400" /> Standardize 1600px
          </button>
          <div className="flex bg-slate-700 p-1 rounded-xl">
            <button onClick={() => setZoom(z => Math.max(0.05, z-0.1))} className="p-2 text-slate-300"><ZoomOut size={16} /></button>
            <span className="px-3 flex items-center text-[10px] font-black w-16 justify-center">{(zoom*100).toFixed(0)}%</span>
            <button onClick={() => setZoom(z => Math.min(10, z+0.1))} className="p-2 text-slate-300"><ZoomIn size={16} /></button>
          </div>
          <button onClick={() => {
            const hist = [...history]; hist.pop(); const prev = hist[hist.length-1];
            if (prev) {
              const img = new Image(); img.src = prev.canvasData;
              img.onload = () => { canvasRef.current!.getContext('2d')!.drawImage(img, 0, 0); setObjects(prev.objects); setHistory(hist); };
            }
          }} disabled={history.length<=1} className="p-2.5 bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300"><Undo size={18} /></button>
          <button onClick={handleFinalSave} disabled={isProcessing} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save & Apply
          </button>
        </div>
      </div>

      <div ref={containerRef} onWheel={e => { e.preventDefault(); setZoom(z => Math.min(10, Math.max(0.05, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }} className="flex-1 bg-slate-700 relative overflow-hidden">
        <div className="absolute origin-center" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, top: '50%', left: '50%', marginTop: canvasRef.current ? -canvasRef.current.height/2 : 0, marginLeft: canvasRef.current ? -canvasRef.current.width/2 : 0 }}>
          {isProcessing && canvasRef.current && (
            <div className="absolute -inset-[20px] z-[80] pointer-events-none">
              <svg width="calc(100% + 40px)" height="calc(100% + 40px)" className="absolute inset-0">
                <rect x="6" y="6" width="calc(100% - 12px)" height="calc(100% - 12px)" fill="none" stroke="#60a5fa" strokeWidth="12" strokeDasharray={`${perimeter * 0.1} ${perimeter * 0.9}`} className="animate-[snake_1.5s_linear_infinite]" strokeLinecap="round" />
              </svg>
            </div>
          )}
          <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.4)] bg-white overflow-hidden">
            <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd} className="block" style={{ cursor: (isMouseOverCanvas && (currentTool === 'ai-erase' || currentTool === 'brush')) ? 'none' : (currentTool === 'crop' ? 'crosshair' : 'default') }} />
            <canvas ref={maskCanvasRef} className="hidden" />
            <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
            <svg className="absolute inset-0 pointer-events-none w-full h-full z-20" viewBox={`0 0 ${canvasRef.current?.width||0} ${canvasRef.current?.height||0}`}>
              {selection && <rect x={Math.min(selection.x1, selection.x2)} y={Math.min(selection.y1, selection.y2)} width={Math.abs(selection.x1-selection.x2)} height={Math.abs(selection.y1-selection.y2)} fill="none" stroke="#60a5fa" strokeWidth={3/zoom} strokeDasharray="6,6" className="animate-[marching-ants_0.8s_linear_infinite]" />}
              {objects.map(obj => (
                <g key={obj.id} transform={`rotate(${obj.rotation*180/Math.PI} ${obj.x+obj.width/2} ${obj.y+obj.height/2})`} opacity={obj.opacity}>
                  {obj.type==='rect' && <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type==='circle' && <ellipse cx={obj.x+obj.width/2} cy={obj.y+obj.height/2} rx={obj.width/2} ry={obj.height/2} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type==='line' && <line x1={obj.x} y1={obj.y} x2={obj.x+obj.width} y2={obj.y+obj.height} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type==='text' && <text x={obj.x} y={obj.y+obj.height} fill={obj.fill} style={{font:`bold ${obj.fontSize}px Inter`}}>{obj.text}</text>}
                  {selectedObjectId===obj.id && <rect x={obj.x-3/zoom} y={obj.y-3/zoom} width={obj.width+6/zoom} height={obj.height+6/zoom} fill="none" stroke="#60a5fa" strokeWidth={3/zoom} strokeDasharray="6" className="animate-[marching-ants_0.8s_linear_infinite]" />}
                </g>
              ))}
            </svg>
          </div>
        </div>
        {isMouseOverCanvas && (currentTool === 'ai-erase' || currentTool === 'brush') && (
          <div className="fixed pointer-events-none z-[200] flex items-center justify-center" style={{ left: mousePos.clientX, top: mousePos.clientY, width: strokeWidth * zoom, height: strokeWidth * zoom, transform: 'translate(-50%, -50%)', opacity: isProcessing ? 0 : 1 }}>
            <div className="w-full h-full border-2 border-dashed rounded-full animate-[spin_8s_linear_infinite]" style={{ borderColor: currentTool === 'ai-erase' ? 'white' : strokeColor }}></div>
          </div>
        )}
        <div className="fixed left-6 top-1/2 -translate-y-1/2 w-16 bg-slate-800/90 backdrop-blur-xl border border-slate-600 flex flex-col items-center py-6 gap-6 rounded-3xl shadow-2xl z-50">
          <ToolIcon active={currentTool==='select'} onClick={()=>{setCurrentTool('select'); setShowShapeMenu(false);}} icon={<MousePointer2 size={18}/>} label="Select" />
          <ToolIcon active={currentTool==='pan'} onClick={()=>{setCurrentTool('pan'); setShowShapeMenu(false);}} icon={<Move size={18}/>} label="Pan" />
          <ToolIcon active={currentTool==='brush'} onClick={()=>{setCurrentTool('brush'); setStrokeWidth(30); setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Palette size={18}/>} label="Brush" />
          <ToolIcon active={currentTool==='ai-erase'} onClick={()=>{setCurrentTool('ai-erase'); setStrokeWidth(50); setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Eraser size={18}/>} label="AI Erase" />
          <div className="relative">
            <ToolIcon active={['rect', 'circle', 'line'].includes(currentTool)} onClick={() => setShowShapeMenu(!showShapeMenu)} icon={<ShapeIcon size={18} type={lastUsedShape} />} label="Shapes" />
            {showShapeMenu && (
              <div className="absolute left-20 top-0 bg-slate-700 border border-slate-600 p-2 rounded-xl shadow-2xl flex flex-col gap-2 z-[100]">
                <button onClick={() => { setCurrentTool('rect'); setLastUsedShape('rect'); setStrokeWidth(2); setShowShapeMenu(false); }} className={`p-3 rounded-lg ${currentTool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}><Square size={18} /></button>
                <button onClick={() => { setCurrentTool('circle'); setLastUsedShape('circle'); setStrokeWidth(2); setShowShapeMenu(false); }} className={`p-3 rounded-lg ${currentTool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}><Circle size={18} /></button>
                <button onClick={() => { setCurrentTool('line'); setLastUsedShape('line'); setStrokeWidth(2); setShowShapeMenu(false); }} className={`p-3 rounded-lg ${currentTool === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}><Minus size={18} /></button>
              </div>
            )}
          </div>
          <ToolIcon active={currentTool==='text'} onClick={()=>{setCurrentTool('text'); setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Type size={18}/>} label="Text" />
          <ToolIcon active={currentTool==='crop'} onClick={()=>{setCurrentTool('crop'); setSelectedObjectId(null); setShowShapeMenu(false);}} icon={<Scissors size={18}/>} label="Crop" />
        </div>
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-slate-800/90 backdrop-blur-xl border border-slate-600 p-6 rounded-[2.5rem] shadow-2xl min-w-[650px] z-50">
          <div className="flex items-center gap-4">
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase text-center block">Stroke</span><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-slate-700 border-none" /></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase text-center block">Fill</span><input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-slate-700 border-none" /></div>
          </div>
          <div className="w-px h-8 bg-slate-600"></div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase"><span>{(selectedObj?.type === 'text' || currentTool === 'text') ? 'Font Size' : 'Size'}</span><span>{(selectedObj?.type === 'text' || currentTool === 'text') ? (selectedObj?.fontSize || fontSize) : (selectedObj?.strokeWidth || strokeWidth)}px</span></div>
            <input type="range" min="1" max="200" value={(selectedObj?.type === 'text' || currentTool === 'text') ? (selectedObj?.fontSize || fontSize) : (selectedObj?.strokeWidth || strokeWidth)} onChange={e => { const v = parseInt(e.target.value); if (currentTool === 'text') setFontSize(v); else setStrokeWidth(v); }} className="w-full h-1 bg-slate-600 appearance-none cursor-pointer accent-indigo-500" />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase"><span>Opacity</span><span>{Math.round((selectedObj?.opacity ?? opacity) * 100)}%</span></div>
            <input type="range" min="0" max="1" step="0.01" value={selectedObj?.opacity ?? opacity} onChange={e=>setOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-600 appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes snake { from { stroke-dashoffset: ${perimeter}; } to { stroke-dashoffset: 0; } }
        @keyframes marching-ants { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 12; } }
      `}</style>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 group transition-all shrink-0 ${active ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/20 border border-indigo-500/50 shadow-lg' : 'hover:bg-slate-700'}`}>{icon}</div>
    <span className="text-[7px] font-black uppercase tracking-tighter opacity-60 group-hover:opacity-100">{label}</span>
  </button>
);

const ShapeIcon = ({ size, type }: { size: number, type: string }) => {
  if (type === 'rect') return <Square size={size} />;
  if (type === 'circle') return <Circle size={size} />;
  return <Minus size={size} />;
};
