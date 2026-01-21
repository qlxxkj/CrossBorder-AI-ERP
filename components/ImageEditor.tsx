
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Wand2, Loader2, Download, MousePointer2, Maximize, 
  Type, Square, Circle, Minus, Move, Palette, Trash2,
  ZoomIn, ZoomOut, RotateCcw, Box, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';
// Import UILanguage to fix type missing
import { UILanguage } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
  // Add uiLang prop to interface
  uiLang: UILanguage;
}

type Tool = 'select' | 'select-fill' | 'brush' | 'ai-erase' | 'crop' | 'rect' | 'circle' | 'line' | 'text' | 'none';

interface EditorObject {
  id: string;
  type: 'rect' | 'circle' | 'line' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // In radians
  stroke: string;
  fill: string;
  strokeWidth: number;
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

// Destructure uiLang from props
export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave, uiLang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [zoom, setZoom] = useState(1);
  
  // Object system
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Unified History System
  const [history, setHistory] = useState<EditorState[]>([]);

  const saveToHistory = useCallback((currentObjects?: EditorObject[]) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const newState: EditorState = {
        canvasData: canvas.toDataURL('image/png'),
        objects: currentObjects ? [...currentObjects] : [...objects]
      };
      setHistory(prev => [...prev.slice(-30), newState]);
    }
  }, [objects]);

  useEffect(() => {
    const initCanvas = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
      if (!ctx) return;

      setIsProcessing(true);
      try {
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Failed to fetch image through proxy");
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.src = localUrl;
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          if (containerRef.current) {
            const padding = 120;
            const availableW = containerRef.current.clientWidth - padding;
            const availableH = containerRef.current.clientHeight - padding;
            const scale = Math.min(availableW / img.width, availableH / img.height, 1);
            setZoom(scale || 1);
          }
          
          const initialState: EditorState = {
            canvasData: canvas.toDataURL('image/png'),
            objects: []
          };
          setHistory([initialState]);
          setIsProcessing(false);
          URL.revokeObjectURL(localUrl);
        };
      } catch (err) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          (ctx as CanvasRenderingContext2D).drawImage(img, 0, 0);
          const initialState: EditorState = {
            canvasData: canvas.toDataURL('image/png'),
            objects: []
          };
          setHistory([initialState]);
          setIsProcessing(false);
        };
      }
    };
    initCanvas();
  }, [imageUrl]);

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); 
    const prevState = newHistory[newHistory.length - 1];
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as CanvasRenderingContext2D | null;
    if (canvas && ctx && prevState) {
      const img = new Image();
      img.src = prevState.canvasData;
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setObjects(prevState.objects);
        setHistory(newHistory);
      };
    }
  };

  const standardize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentData = canvas.toDataURL();
    const tempImg = new Image();
    tempImg.src = currentData;
    tempImg.onload = () => {
      const targetSize = 1600;
      const safeArea = 1500;
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetSize, targetSize);
      const scale = Math.min(safeArea / tempImg.width, safeArea / tempImg.height);
      const drawW = tempImg.width * scale;
      const drawH = tempImg.height * scale;
      const x = (targetSize - drawW) / 2;
      const y = (targetSize - drawH) / 2;
      ctx.drawImage(tempImg, x, y, drawW, drawH);
      saveToHistory();
      if (containerRef.current) {
        setZoom(Math.min((containerRef.current.clientHeight - 120) / 1600, 1));
      }
    };
  };

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    setStartPos(pos);

    if (currentTool === 'select') {
      if (selectedObjectId) {
        const obj = objects.find(o => o.id === selectedObjectId);
        if (obj) {
          const handleSize = 12 / zoom;
          const rotateHandleY = obj.y - 30 / zoom;
          const centerX = obj.x + obj.width / 2;
          
          // Basic hit test for rotation handle
          const distToRotate = Math.sqrt(Math.pow(pos.x - centerX, 2) + Math.pow(pos.y - rotateHandleY, 2));
          if (distToRotate < handleSize) {
            setIsRotating(true);
            return;
          }

          const isOverResizeHandle = 
            pos.x >= obj.x + obj.width - handleSize && 
            pos.x <= obj.x + obj.width + handleSize && 
            pos.y >= obj.y + obj.height - handleSize && 
            pos.y <= obj.y + obj.height + handleSize;

          if (isOverResizeHandle) {
            setIsResizing(true);
            return;
          }

          const isOverBody = 
            pos.x >= obj.x && pos.x <= obj.x + obj.width &&
            pos.y >= obj.y && pos.y <= obj.y + obj.height;
          
          if (isOverBody) {
            setIsDragging(true);
            setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
            return;
          }
        }
      }

      const hit = objects.slice().reverse().find(obj => 
        pos.x >= obj.x && pos.x <= obj.x + obj.width &&
        pos.y >= obj.y && pos.y <= obj.y + obj.height
      );
      
      if (hit) {
        setSelectedObjectId(hit.id);
        setIsDragging(true);
        setDragOffset({ x: pos.x - hit.x, y: pos.y - hit.y });
      } else {
        setSelectedObjectId(null);
      }
      return;
    }

    setIsDrawing(true);
    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) {
      setSelection({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    }

    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const ctx = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentTool === 'ai-erase' ? 'rgba(255, 0, 0, 0.6)' : strokeColor;
        ctx.lineWidth = brushSize;
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'select' && selectedObjectId) {
      const obj = objects.find(o => o.id === selectedObjectId);
      if (!obj) return;

      if (isDragging) {
        setObjects(prev => prev.map(o => 
          o.id === selectedObjectId 
            ? { ...o, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
            : o
        ));
      } else if (isResizing) {
        setObjects(prev => prev.map(o => 
          o.id === selectedObjectId 
            ? { ...o, width: Math.max(10, pos.x - o.x), height: Math.max(10, pos.y - o.y) }
            : o
        ));
      } else if (isRotating) {
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) + Math.PI / 2;
        setObjects(prev => prev.map(o => 
          o.id === selectedObjectId ? { ...o, rotation: angle } : o
        ));
      }
      return;
    }

    if (!isDrawing) return;

    if (['rect', 'circle', 'line', 'select-fill', 'crop'].includes(currentTool)) {
      setSelection(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
    } else if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const ctx = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (currentTool === 'select') {
      if (isDragging || isResizing || isRotating) {
        saveToHistory(objects);
      }
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    
    const pos = getMousePos(e);

    if (['rect', 'circle', 'line'].includes(currentTool)) {
      const newObj: EditorObject = {
        id: crypto.randomUUID(),
        type: currentTool as any,
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(startPos.x - pos.x),
        height: Math.abs(startPos.y - pos.y),
        rotation: 0,
        stroke: strokeColor,
        fill: fillColor,
        strokeWidth: brushSize
      };
      const nextObjects = [...objects, newObj];
      setObjects(nextObjects);
      setSelectedObjectId(newObj.id);
      setCurrentTool('select');
      setSelection(null);
      saveToHistory(nextObjects);
    } else if (currentTool === 'text') {
      const text = window.prompt(uiLang === 'zh' ? "输入文字:" : "Enter text:");
      if (text) {
        const newObj: EditorObject = {
          id: crypto.randomUUID(),
          type: 'text',
          x: pos.x,
          y: pos.y,
          width: text.length * brushSize * 3,
          height: brushSize * 6,
          rotation: 0,
          stroke: strokeColor,
          fill: fillColor,
          strokeWidth: brushSize,
          text: text
        };
        const nextObjects = [...objects, newObj];
        setObjects(nextObjects);
        setSelectedObjectId(newObj.id);
        setCurrentTool('select');
        saveToHistory(nextObjects);
      }
    } else if (currentTool === 'brush') {
      saveToHistory();
    }
  };

  const handleFill = () => {
    if (currentTool !== 'select-fill' || !selection) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const x = Math.min(selection.x1, selection.x2);
    const y = Math.min(selection.y1, selection.y2);
    const w = Math.abs(selection.x1 - selection.x2);
    const h = Math.abs(selection.y1 - selection.y2);
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    saveToHistory();
    setSelection(null); 
  };

  const handleCrop = () => {
    if (!selection) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const x = Math.min(selection.x1, selection.x2);
    const y = Math.min(selection.y1, selection.y2);
    const w = Math.abs(selection.x1 - selection.x2);
    const h = Math.abs(selection.y1 - selection.y2);
    if (w < 5 || h < 5) return;
    const imageData = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
    setSelection(null);
    setZoom(1);
  };

  const runAIErase = async () => {
    setIsProcessing(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      const result = await editImageWithAI(base64, "Please erase the red highlighted areas cleanly.");
      const img = new Image();
      img.src = `data:image/jpeg;base64,${result}`;
      img.onload = () => {
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
        setIsProcessing(false);
      };
    } catch (e: any) {
      alert("AI Erase failed: " + e.message);
      setIsProcessing(false);
    }
  };

  const handleFinalSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    objects.forEach(obj => {
      ctx.save();
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      
      ctx.translate(cx, cy);
      ctx.rotate(obj.rotation);
      ctx.translate(-cx, -cy);

      ctx.strokeStyle = obj.stroke;
      ctx.fillStyle = obj.fill;
      ctx.lineWidth = obj.strokeWidth;
      ctx.lineCap = 'round';

      if (obj.type === 'rect') {
        ctx.beginPath();
        ctx.rect(obj.x, obj.y, obj.width, obj.height);
        ctx.fill();
        ctx.stroke();
      } else if (obj.type === 'circle') {
        const r = Math.sqrt(obj.width * obj.width + obj.height * obj.height) / 2;
        ctx.beginPath();
        ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obj.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
        ctx.stroke();
      } else if (obj.type === 'text' && obj.text) {
        ctx.font = `bold ${obj.strokeWidth * 6}px Inter, sans-serif`;
        ctx.fillText(obj.text, obj.x, obj.y);
        ctx.strokeText(obj.text, obj.x, obj.y);
      }
      ctx.restore();
    });

    onSave(canvas.toDataURL('image/jpeg', 0.95));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        const nextObjects = objects.filter(o => o.id !== selectedObjectId);
        setObjects(nextObjects);
        setSelectedObjectId(null);
        saveToHistory(nextObjects);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, objects, saveToHistory]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-inter">
      <div className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shadow-xl z-20">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"><X size={20} /></button>
          <div className="h-6 w-px bg-slate-800"></div>
          <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">AI Media Lab</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setZoom(prev => Math.max(0.05, prev - 0.1))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ZoomOut size={16} /></button>
            <span className="px-3 flex items-center text-[10px] font-black text-slate-300 w-16 justify-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => setZoom(prev => Math.min(5, prev + 0.1))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ZoomIn size={16} /></button>
          </div>
          <button onClick={undo} disabled={history.length <= 1} className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300 transition-all"><Undo size={18} /></button>
          <button onClick={standardize} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black flex items-center gap-2 border border-slate-700"><Maximize size={16} /> 1600*1600</button>
          <button onClick={handleFinalSave} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transform active:scale-95 transition-all"><Save size={16} /> Save & Apply</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-24 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-20 overflow-y-auto no-scrollbar">
          <ToolIcon active={currentTool === 'select'} onClick={() => { setCurrentTool('select'); }} icon={<MousePointer2 size={20} />} label="Select" />
          <ToolIcon active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelectedObjectId(null); }} icon={<Palette size={20} />} label="Brush" />
          <ToolIcon active={currentTool === 'ai-erase'} onClick={() => { setCurrentTool('ai-erase'); setSelectedObjectId(null); }} icon={<Eraser size={20} />} label="AI Erase" />
          <ToolIcon active={currentTool === 'rect'} onClick={() => { setCurrentTool('rect'); setSelectedObjectId(null); }} icon={<Square size={20} />} label="Rect" />
          <ToolIcon active={currentTool === 'circle'} onClick={() => { setCurrentTool('circle'); setSelectedObjectId(null); }} icon={<Circle size={20} />} label="Circle" />
          <ToolIcon active={currentTool === 'line'} onClick={() => { setCurrentTool('line'); setSelectedObjectId(null); }} icon={<Minus size={20} />} label="Line" />
          <ToolIcon active={currentTool === 'text'} onClick={() => { setCurrentTool('text'); setSelectedObjectId(null); }} icon={<Type size={20} />} label="Text" />
          <ToolIcon active={currentTool === 'select-fill'} onClick={() => { setCurrentTool('select-fill'); setSelectedObjectId(null); }} icon={<PaintBucket size={20} />} label="Fill" />
          <ToolIcon active={currentTool === 'crop'} onClick={() => { setCurrentTool('crop'); setSelectedObjectId(null); }} icon={<Scissors size={20} />} label="Crop" />
          
          <div className="mt-auto flex flex-col gap-4 pb-4">
             <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-500 uppercase text-center block">Stroke</span>
               <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer bg-slate-800 p-1 border border-slate-700" />
             </div>
             <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-500 uppercase text-center block">Fill</span>
               <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer bg-slate-800 p-1 border border-slate-700" />
             </div>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-20 relative">
          <div className="relative shadow-2xl transition-transform duration-75 origin-center" style={{ transform: `scale(${zoom})` }}>
            <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} className="block relative" style={{ cursor: currentTool === 'none' ? 'default' : currentTool === 'select' ? 'default' : 'crosshair' }} />
            
            <svg 
              className="absolute inset-0 pointer-events-none w-full h-full"
              viewBox={`0 0 ${canvasRef.current?.width || 0} ${canvasRef.current?.height || 0}`}
            >
              {objects.map(obj => (
                <g 
                  key={obj.id} 
                  className={selectedObjectId === obj.id ? 'opacity-100' : 'opacity-80'}
                  transform={`rotate(${(obj.rotation * 180) / Math.PI} ${obj.x + obj.width / 2} ${obj.y + obj.height / 2})`}
                >
                  {obj.type === 'rect' && <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} stroke={obj.stroke} fill={obj.fill} strokeWidth={obj.strokeWidth} />}
                  {obj.type === 'circle' && <ellipse cx={obj.x + obj.width/2} cy={obj.y + obj.height/2} rx={obj.width/2} ry={obj.height/2} stroke={obj.stroke} fill={obj.fill} strokeWidth={obj.strokeWidth} />}
                  {obj.type === 'line' && <line x1={obj.x} y1={obj.y} x2={obj.x + obj.width} y2={obj.y + obj.height} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
                  {obj.type === 'text' && (
                    <text 
                      x={obj.x} 
                      y={obj.y + obj.height/2} 
                      fill={obj.fill} 
                      stroke={obj.stroke} 
                      strokeWidth={obj.strokeWidth/4} 
                      style={{ font: `bold ${obj.strokeWidth * 6}px Inter, sans-serif` }}
                    >
                      {obj.text}
                    </text>
                  )}
                  {selectedObjectId === obj.id && (
                    <>
                      <rect 
                        x={obj.x} y={obj.y} width={obj.width} height={obj.height} 
                        fill="none" stroke="#6366f1" strokeWidth={2 / zoom} strokeDasharray="4"
                      />
                      {/* Resize handle */}
                      <circle 
                        cx={obj.x + obj.width} cy={obj.y + obj.height} r={6 / zoom} 
                        fill="#6366f1" className="cursor-nwse-resize pointer-events-auto" 
                      />
                      {/* Rotation handle */}
                      <line x1={obj.x + obj.width/2} y1={obj.y} x2={obj.x + obj.width/2} y2={obj.y - 30/zoom} stroke="#6366f1" strokeWidth={2/zoom} />
                      <circle 
                        cx={obj.x + obj.width/2} cy={obj.y - 30/zoom} r={8 / zoom} 
                        fill="#6366f1" className="cursor-pointer pointer-events-auto"
                      >
                         <title>Rotate</title>
                      </circle>
                    </>
                  )}
                </g>
              ))}
            </svg>

            {selection && (['select-fill', 'crop'].includes(currentTool)) && (
               <div className="absolute pointer-events-none border-2 border-white" style={{ left: Math.min(selection.x1, selection.x2), top: Math.min(selection.y1, selection.y2), width: Math.abs(selection.x1 - selection.x2), height: Math.abs(selection.y1 - selection.y2) }}>
                 <div className="absolute inset-0 border-2 border-dashed border-black/50 animate-pulse"></div>
               </div>
            )}
          </div>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-3xl shadow-2xl z-30 min-w-[500px]">
             <div className="flex flex-col gap-1 flex-1">
               <div className="flex justify-between">
                 <span className="text-[10px] font-black text-slate-500 uppercase">Size / Stroke Width</span>
                 <span className="text-[10px] font-black text-blue-400">{brushSize}px</span>
               </div>
               <input type="range" min="1" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
             </div>
             
             {currentTool === 'ai-erase' && (
               <button onClick={runAIErase} disabled={isProcessing} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                 {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} AI ERASE
               </button>
             )}
             {currentTool === 'select-fill' && (
               <button onClick={handleFill} disabled={!selection} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-xl active:scale-95 transition-all">FILL AREA</button>
             )}
             {currentTool === 'crop' && (
               <button onClick={handleCrop} disabled={!selection} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-xl active:scale-95 transition-all">CONFIRM CROP</button>
             )}
             {['select', 'rect', 'circle', 'line', 'text', 'brush', 'none'].includes(currentTool) && currentTool !== 'ai-erase' && (
                <div className="px-10 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {currentTool === 'select' ? (selectedObjectId ? 'Object Selected (Drag top circle to rotate)' : 'Select an object') : `${currentTool} tool active`}
                </div>
             )}
          </div>

          {isProcessing && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md"><Loader2 size={40} className="text-indigo-500 animate-spin" /><p className="mt-8 text-white font-black tracking-[0.3em] text-sm uppercase">AI Processing...</p></div>}
        </div>
      </div>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 group transition-all shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600/10 border border-indigo-500/50 shadow-lg' : 'bg-slate-800/50 hover:bg-slate-800'}`}>
      {icon}
    </div>
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);
