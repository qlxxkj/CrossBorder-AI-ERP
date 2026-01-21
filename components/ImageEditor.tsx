
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Wand2, Loader2, Download, MousePointer2, Maximize, 
  Type, Square, Circle, Minus, Move, Palette, Trash2,
  ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
}

type Tool = 'select-fill' | 'brush' | 'ai-erase' | 'crop' | 'none';

interface SelectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const CORS_PROXY = 'https://corsproxy.io/?';

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

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
          
          saveToHistory();
          setIsProcessing(false);
          URL.revokeObjectURL(localUrl);
        };
      } catch (err) {
        console.warn("Proxy load failed, falling back to direct load:", err);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          (ctx as CanvasRenderingContext2D).drawImage(img, 0, 0);
          saveToHistory();
          setIsProcessing(false);
        };
      }
    };
    initCanvas();
  }, [imageUrl]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory(prev => [...prev.slice(-20), canvas.toDataURL('image/png')]);
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); 
    const last = newHistory[newHistory.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as CanvasRenderingContext2D | null;
    if (canvas && ctx && last) {
      const img = new Image();
      img.src = last;
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
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

  const handleFill = useCallback(() => {
    if (currentTool !== 'select-fill' || !selection) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const x = Math.min(selection.x1, selection.x2);
    const y = Math.min(selection.y1, selection.y2);
    const w = Math.abs(selection.x1 - selection.x2);
    const h = Math.abs(selection.y1 - selection.y2);
    if (w < 1 || h < 1) return;
    ctx.fillStyle = brushColor;
    ctx.fillRect(x, y, w, h);
    saveToHistory();
    setSelection(null); 
  }, [currentTool, selection, brushColor]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && currentTool === 'select-fill' && selection) {
        handleFill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTool, selection, handleFill]);

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
    if (currentTool === 'none') return;
    const pos = getMousePos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDrawing(true);
    if (currentTool === 'select-fill' || currentTool === 'crop') {
      setSelection({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    }
    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const ctx = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentTool === 'ai-erase' ? 'rgba(255, 0, 0, 0.6)' : brushColor;
        ctx.lineWidth = brushSize;
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    setCurrentPos(pos);
    if (currentTool === 'select-fill' || currentTool === 'crop') {
      setSelection(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
    }
    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const ctx = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    if (currentTool === 'brush') {
      saveToHistory();
    }
    setIsDrawing(false);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsUploading(true);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      onSave(dataUrl);
    } catch (e) {
      alert("Save failed due to cross-origin canvas security. Try refreshing.");
    } finally {
      setIsUploading(false);
    }
  };

  const runAIErase = async () => {
    setIsProcessing(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      const result = await editImageWithAI(base64, "Please erase the red highlighted areas cleanly and regenerate the background naturally.");
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-inter">
      {/* Header */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shadow-xl z-20">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white">
            <X size={20} />
          </button>
          <div className="h-6 w-px bg-slate-800"></div>
          <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">AI Media Lab</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setZoom(prev => Math.max(0.05, prev - 0.1))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ZoomOut size={16} /></button>
            <span className="px-3 flex items-center text-[10px] font-black text-slate-300 w-16 justify-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => setZoom(prev => Math.min(5, prev + 0.1))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ZoomIn size={16} /></button>
          </div>
          
          <button onClick={undo} disabled={history.length <= 1} className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300 transition-all">
            <Undo size={18} />
          </button>
          
          <button onClick={standardize} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black flex items-center gap-2 border border-slate-700">
            <Maximize size={16} /> 1600*1600
          </button>
          
          <button 
            onClick={handleSave}
            disabled={isUploading}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transform active:scale-95 transition-all disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save & Apply
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <div className="w-24 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 gap-8 z-20">
          <ToolIcon active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelection(null); }} icon={<Palette size={22} />} label="Brush" />
          <ToolIcon active={currentTool === 'ai-erase'} onClick={() => { setCurrentTool('ai-erase'); setSelection(null); }} icon={<Eraser size={22} />} label="AI Erase" />
          <ToolIcon active={currentTool === 'select-fill'} onClick={() => { setCurrentTool('select-fill'); setSelection(null); }} icon={<Square size={22} />} label="Fill" />
          <ToolIcon active={currentTool === 'crop'} onClick={() => { setCurrentTool('crop'); setSelection(null); }} icon={<Crop size={22} />} label="Crop" />
          
          <div className="mt-auto flex flex-col items-center gap-6 pb-4">
             <div className="relative group">
               <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-12 h-12 rounded-2xl cursor-pointer bg-slate-800 p-1 border border-slate-700 shadow-xl"
               />
             </div>
          </div>
        </div>

        {/* Workspace */}
        <div 
          ref={containerRef}
          className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-20 relative"
          onWheel={(e) => {
            if (e.ctrlKey) {
              setZoom(z => Math.max(0.05, Math.min(5, z - e.deltaY * 0.001)));
              e.preventDefault();
            }
          }}
        >
          <div 
            className="relative shadow-2xl transition-transform duration-75 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="absolute inset-0 bg-white"></div>
            <canvas
              ref={canvasRef}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              className={`block relative ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              style={{ cursor: currentTool === 'none' ? 'default' : 'crosshair' }}
            />
            {selection && (currentTool === 'select-fill' || currentTool === 'crop') && (
               <div 
                 className={`absolute pointer-events-none border-2 border-white`}
                 style={{
                   left: Math.min(selection.x1, selection.x2),
                   top: Math.min(selection.y1, selection.y2),
                   width: Math.abs(selection.x1 - selection.x2),
                   height: Math.abs(selection.y1 - selection.y2),
                 }}
               >
                 <div className="absolute inset-0 border-2 border-dashed animate-marching-ants"></div>
                 <div className={`absolute inset-0 ${currentTool === 'crop' ? 'bg-blue-500/10' : 'bg-indigo-500/10'} backdrop-blur-[1px]`}></div>
               </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-3xl shadow-2xl z-30 min-w-[400px]">
             {currentTool === 'brush' || currentTool === 'ai-erase' ? (
               <div className="flex items-center gap-6 w-full">
                 <div className="flex flex-col gap-1 flex-1">
                   <div className="flex justify-between">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Brush Size</span>
                     <span className="text-[10px] font-black text-blue-400">{brushSize}px</span>
                   </div>
                   <input 
                     type="range" min="1" max="150" 
                     value={brushSize} 
                     onChange={(e) => setBrushSize(parseInt(e.target.value))}
                     className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                   />
                 </div>
                 {currentTool === 'ai-erase' && (
                   <button 
                     onClick={runAIErase}
                     disabled={isProcessing}
                     className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                   >
                     {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                     AI ERASE
                   </button>
                 )}
               </div>
             ) : currentTool === 'select-fill' ? (
               <div className="flex items-center justify-between w-full px-4">
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-white uppercase tracking-tighter">Fill Tool</span>
                   <span className="text-[10px] text-slate-500 font-bold tracking-widest">PRESS DELETE TO FILL</span>
                 </div>
                 <button onClick={handleFill} disabled={!selection} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                   <PaintBucket size={16} /> FILL AREA
                 </button>
               </div>
             ) : currentTool === 'crop' ? (
               <div className="flex items-center justify-between w-full px-4">
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-white uppercase tracking-tighter">Crop Tool</span>
                   <span className="text-[10px] text-slate-500 font-bold tracking-widest">DRAG TO SELECT AREA</span>
                 </div>
                 <button onClick={handleCrop} disabled={!selection} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                   <Scissors size={16} /> CONFIRM CROP
                 </button>
               </div>
             ) : (
               <div className="w-full text-center px-10 py-1">
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                   Select a tool to enhance media
                 </p>
               </div>
             )}
          </div>

          {(isProcessing || isUploading) && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md">
               <Loader2 size={40} className="text-indigo-500 animate-spin" />
               <p className="mt-8 text-white font-black tracking-[0.3em] text-sm uppercase animate-pulse">
                 {isUploading ? 'Saving...' : 'AI Processing...'}
               </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes marching-ants-animation {
          0% { background-position: 0 0, 0 100%, 0 0, 100% 0; }
          100% { background-position: 15px 0, -15px 100%, 0 -15px, 100% 15px; }
        }
        .animate-marching-ants {
          background-image: linear-gradient(90deg, #fff 50%, transparent 50%), 
                            linear-gradient(90deg, #fff 50%, transparent 50%), 
                            linear-gradient(0deg, #fff 50%, transparent 50%), 
                            linear-gradient(0deg, #fff 50%, transparent 50%);
          background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
          background-size: 15px 2px, 15px 2px, 2px 15px, 2px 15px;
          animation: marching-ants-animation 0.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-2 group transition-all relative ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
        active 
          ? 'bg-indigo-600/10 border border-indigo-500/50 shadow-lg' 
          : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
    }`}>
      {icon}
    </div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    {active && <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-full shadow-lg"></div>}
  </button>
);
