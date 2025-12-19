
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, 
  Wand2, Loader2, Download, MousePointer2, Maximize, 
  Type, Square, Circle, Minus, Move, Palette, Trash2
} from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
}

type Tool = 'select-fill' | 'brush' | 'ai-erase' | 'crop' | 'none';

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<string[]>([]);
  
  // Interaction state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  // Initialize canvas with original image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      saveToHistory();
    };
  }, [imageUrl]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory(prev => [...prev.slice(-10), canvas.toDataURL()]);
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const last = newHistory[newHistory.length - 1];
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
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

  // 1. One-click Standardize (1600x1600 white background)
  const standardize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const currentData = canvas.toDataURL();
    const tempImg = new Image();
    tempImg.src = currentData;
    tempImg.onload = () => {
      const targetSize = 1600;
      const safeArea = 1500;
      const padding = 50;

      // New canvas
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d')!;
      
      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetSize, targetSize);

      // Calculate scale to fit in 1500x1500Box
      const scale = Math.min(safeArea / tempImg.width, safeArea / tempImg.height);
      const drawW = tempImg.width * scale;
      const drawH = tempImg.height * scale;
      const x = (targetSize - drawW) / 2;
      const y = (targetSize - drawH) / 2;

      ctx.drawImage(tempImg, x, y, drawW, drawH);
      saveToHistory();
    };
  };

  // Drawing Logic
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (currentTool === 'none') return;
    const pos = getMousePos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDrawing(true);

    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentTool === 'ai-erase' ? 'rgba(255, 0, 0, 0.5)' : brushColor;
        ctx.lineWidth = brushSize;
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    setCurrentPos(pos);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    if (currentTool === 'brush' || currentTool === 'ai-erase') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentTool === 'brush') {
      saveToHistory();
    } else if (currentTool === 'ai-erase') {
      // We don't save to history immediately, wait for user to confirm "Run AI Erase"
    } else if (currentTool === 'select-fill') {
      // Wait for "Fill" button
    }
  };

  // Actions
  const handleFill = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(startPos.x - currentPos.x);
    const h = Math.abs(startPos.y - currentPos.y);

    ctx.fillStyle = brushColor;
    ctx.fillRect(x, y, w, h);
    saveToHistory();
    setCurrentTool('none');
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(startPos.x - currentPos.x);
    const h = Math.abs(startPos.y - currentPos.y);

    if (w < 5 || h < 5) return;

    const imageData = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
    setCurrentTool('none');
  };

  const runAIErase = async () => {
    setIsProcessing(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const base64 = canvas.toDataURL().split(',')[1];
      const result = await editImageWithAI(base64, "Remove the objects, text, or logos highlighted in the red markings naturally, preserving the background texture and lighting.");
      
      const img = new Image();
      img.src = `data:image/png;base64,${result}`;
      img.onload = () => {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
        setCurrentTool('none');
        setIsProcessing(false);
      };
    } catch (e: any) {
      alert(e.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-md flex flex-col">
      {/* Header */}
      <div className="h-16 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
          <h2 className="font-black tracking-tight text-lg">MEDIA STUDIO</h2>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={undo}
            className="px-4 py-2 text-slate-400 hover:text-white flex items-center gap-2 text-xs font-bold"
          >
            <Undo size={16} /> UNDO
          </button>
          <button 
            onClick={standardize}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold flex items-center gap-2"
          >
            <Maximize size={16} /> STANDARDIZE (1600x1600)
          </button>
          <button 
            onClick={() => onSave(canvasRef.current?.toDataURL() || imageUrl)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-black shadow-lg flex items-center gap-2"
          >
            <Save size={16} /> SAVE CHANGES
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <div className="w-20 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 gap-6">
          <ToolIcon 
            active={currentTool === 'brush'} 
            onClick={() => setCurrentTool('brush')} 
            icon={<Palette size={22} />} 
            label="Brush" 
          />
          <ToolIcon 
            active={currentTool === 'ai-erase'} 
            onClick={() => setCurrentTool('ai-erase')} 
            icon={<Eraser size={22} />} 
            label="AI Erase" 
          />
          <ToolIcon 
            active={currentTool === 'select-fill'} 
            onClick={() => setCurrentTool('select-fill')} 
            icon={<Square size={22} />} 
            label="Fill" 
          />
          <ToolIcon 
            active={currentTool === 'crop'} 
            onClick={() => setCurrentTool('crop')} 
            icon={<Crop size={22} />} 
            label="Crop" 
          />
          <div className="mt-auto flex flex-col items-center gap-4">
            <input 
              type="color" 
              value={brushColor} 
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-10 h-10 rounded-full cursor-pointer bg-transparent border-none"
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-12 relative">
          <div className="relative shadow-2xl group">
            {/* Checkerboard pattern for transparency */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none opacity-20"></div>
            
            <canvas
              ref={canvasRef}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              className={`max-w-none shadow-2xl cursor-crosshair bg-white ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            />

            {/* Selection/Crop Overlay */}
            {isDrawing && (currentTool === 'select-fill' || currentTool === 'crop') && (
               <div 
                 className={`absolute pointer-events-none border-2 border-dashed ${currentTool === 'crop' ? 'border-blue-500 bg-blue-500/10' : 'border-indigo-500 bg-indigo-500/10'}`}
                 style={{
                   left: Math.min(startPos.x, currentPos.x) / (canvasRef.current?.width || 1) * 100 + '%',
                   top: Math.min(startPos.y, currentPos.y) / (canvasRef.current?.height || 1) * 100 + '%',
                   width: Math.abs(startPos.x - currentPos.x) / (canvasRef.current?.width || 1) * 100 + '%',
                   height: Math.abs(startPos.y - currentPos.y) / (canvasRef.current?.height || 1) * 100 + '%',
                 }}
               />
            )}
          </div>

          {/* Context Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-800 border border-slate-700 p-2 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4">
             {currentTool === 'brush' || currentTool === 'ai-erase' ? (
               <div className="flex items-center gap-3 px-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase">Size</span>
                 <input 
                   type="range" min="1" max="100" 
                   value={brushSize} 
                   onChange={(e) => setBrushSize(parseInt(e.target.value))}
                   className="w-32 accent-blue-600"
                 />
                 <span className="text-xs font-bold text-white w-6">{brushSize}</span>
                 {currentTool === 'ai-erase' && (
                   <button 
                     onClick={runAIErase}
                     disabled={isProcessing}
                     className="ml-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2"
                   >
                     {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                     RUN AI ERASE
                   </button>
                 )}
               </div>
             ) : currentTool === 'select-fill' ? (
               <div className="flex items-center gap-3 px-4 py-1">
                 <span className="text-xs font-bold text-white uppercase tracking-widest">Draw rectangle area then</span>
                 <button onClick={handleFill} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg">
                   FILL WITH COLOR
                 </button>
               </div>
             ) : currentTool === 'crop' ? (
               <div className="flex items-center gap-3 px-4 py-1">
                 <span className="text-xs font-bold text-white uppercase tracking-widest">Select area to</span>
                 <button onClick={handleCrop} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg">
                   APPLY CROP
                 </button>
               </div>
             ) : (
               <div className="px-6 py-2 text-slate-500 text-xs font-bold italic">
                 Select a tool from the left sidebar to start editing
               </div>
             )}
          </div>

          {isProcessing && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
               <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-white font-black tracking-widest text-sm uppercase">AI Generating Magic...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 group transition-all ${active ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-blue-600/20 shadow-inner' : 'bg-slate-700/50 group-hover:bg-slate-700'}`}>
      {icon}
    </div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);
