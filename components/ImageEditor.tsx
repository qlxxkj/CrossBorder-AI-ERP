
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

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  
  // Interaction state
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  // 1. 强化图片初始化：确保图片能载入并居中，同时处理可能的渲染延迟
  useEffect(() => {
    const initCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // 自动缩放以适应屏幕
        if (containerRef.current) {
          const padding = 120;
          const availableW = containerRef.current.clientWidth - padding;
          const availableH = containerRef.current.clientHeight - padding;
          const scale = Math.min(availableW / img.width, availableH / img.height, 1);
          setZoom(scale || 1);
        }
        
        saveToHistory();
      };

      img.onerror = () => {
        console.error("Failed to load image into editor:", imageUrl);
      };
    };

    // 稍微延迟确保 DOM 和 Ref 稳定
    const timer = setTimeout(initCanvas, 100);
    return () => clearTimeout(timer);
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

  // 2. 1600*1600 标准化工具
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
      const ctx = canvas.getContext('2d')!;
      
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

  // 3. 填色及裁剪逻辑：保持工具状态，优化选框逻辑
  const handleFill = useCallback(() => {
    if (currentTool !== 'select-fill' || !selection) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const x = Math.min(selection.x1, selection.x2);
    const y = Math.min(selection.y1, selection.y2);
    const w = Math.abs(selection.x1 - selection.x2);
    const h = Math.abs(selection.y1 - selection.y2);

    if (w < 1 || h < 1) return;

    ctx.fillStyle = brushColor;
    ctx.fillRect(x, y, w, h);
    saveToHistory();
    setSelection(null); // 清除选框，但保留工具
  }, [currentTool, selection, brushColor]);

  const handleCrop = () => {
    if (!selection) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
    // 操作完依然保持 'crop' 工具选中状态
  };

  // 4. Delete 键快捷填充
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
      const ctx = canvasRef.current?.getContext('2d');
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
      const ctx = canvasRef.current?.getContext('2d');
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

  const runAIErase = async () => {
    setIsProcessing(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // 提交带擦除标记的图
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      const result = await editImageWithAI(base64, "Please erase the red highlighted areas cleanly and regenerate the background naturally.");
      
      const img = new Image();
      img.src = `data:image/jpeg;base64,${result}`;
      img.onload = () => {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
        setIsProcessing(false);
      };
    } catch (e: any) {
      alert("AI 擦除失败: " + e.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col font-inter">
      {/* Header */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shadow-xl z-20">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white">
            <X size={20} />
          </button>
          <div className="h-6 w-px bg-slate-800"></div>
          <h2 className="font-black tracking-tighter text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">AI MEDIA PRO</h2>
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
            <Maximize size={16} /> 1600*1600 (居中)
          </button>
          
          <button 
            onClick={() => onSave(canvasRef.current?.toDataURL('image/jpeg', 0.95) || imageUrl)}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-black shadow-lg shadow-indigo-900/40 flex items-center gap-2 transform active:scale-95 transition-all"
          >
            <Save size={16} /> 保存所有更改
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <div className="w-24 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 gap-8 z-20">
          <ToolIcon active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); setSelection(null); }} icon={<Palette size={24} />} label="画笔" />
          <ToolIcon active={currentTool === 'ai-erase'} onClick={() => { setCurrentTool('ai-erase'); setSelection(null); }} icon={<Eraser size={24} />} label="AI 擦除" />
          <ToolIcon active={currentTool === 'select-fill'} onClick={() => { setCurrentTool('select-fill'); setSelection(null); }} icon={<Square size={24} />} label="选择填充" />
          <ToolIcon active={currentTool === 'crop'} onClick={() => { setCurrentTool('crop'); setSelection(null); }} icon={<Crop size={24} />} label="自定义裁剪" />
          
          <div className="mt-auto flex flex-col items-center gap-6 pb-4">
             <div className="relative group">
               <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-12 h-12 rounded-2xl cursor-pointer bg-slate-800 p-1 border border-slate-700 shadow-xl"
               />
               <div className="absolute left-full ml-4 px-3 py-1 bg-white text-slate-900 text-[10px] font-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none uppercase">颜色选择</div>
             </div>
          </div>
        </div>

        {/* Workspace */}
        <div 
          ref={containerRef}
          className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-20 relative selection:bg-transparent"
          onWheel={(e) => {
            if (e.ctrlKey) {
              setZoom(z => Math.max(0.05, Math.min(5, z - e.deltaY * 0.001)));
              e.preventDefault();
            }
          }}
        >
          <div 
            className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-transform duration-75 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* 背景层 */}
            <div className="absolute inset-0 bg-white shadow-2xl"></div>
            
            <canvas
              ref={canvasRef}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              className={`block relative shadow-2xl ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              style={{ cursor: currentTool === 'none' ? 'default' : 'crosshair' }}
            />

            {/* 选择填充和裁剪的持久化选框 - 仅在对应工具激活时显示 */}
            {selection && (currentTool === 'select-fill' || currentTool === 'crop') && (
               <div 
                 className={`absolute pointer-events-none border-2 border-white`}
                 style={{
                   left: Math.min(selection.x1, selection.x2),
                   top: Math.min(selection.y1, selection.y2),
                   width: Math.abs(selection.x1 - selection.x2),
                   height: Math.abs(selection.y1 - selection.y2),
                   display: (Math.abs(selection.x1 - selection.x2) < 1 && Math.abs(selection.y1 - selection.y2) < 1) ? 'none' : 'block'
                 }}
               >
                 <div className="absolute inset-0 border-2 border-dashed animate-marching-ants"></div>
                 <div className={`absolute inset-0 ${currentTool === 'crop' ? 'bg-blue-500/10' : 'bg-indigo-500/10'} backdrop-blur-[1px]`}></div>
               </div>
            )}
          </div>

          {/* Context Control Panel */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-30 min-w-[400px]">
             {currentTool === 'brush' || currentTool === 'ai-erase' ? (
               <div className="flex items-center gap-6 w-full">
                 <div className="flex flex-col gap-1 flex-1">
                   <div className="flex justify-between">
                     <span className="text-[10px] font-black text-slate-500 uppercase">画笔粗细</span>
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
                     开始 AI 智能擦除
                   </button>
                 )}
               </div>
             ) : currentTool === 'select-fill' ? (
               <div className="flex items-center justify-between w-full px-4">
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-white uppercase tracking-tighter">框选区域</span>
                   <span className="text-[10px] text-slate-500 font-bold">按下 Delete 键或点击按钮填充颜色</span>
                 </div>
                 <button onClick={handleFill} disabled={!selection} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                   <PaintBucket size={16} /> 填充选区
                 </button>
               </div>
             ) : currentTool === 'crop' ? (
               <div className="flex items-center justify-between w-full px-4">
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-white uppercase tracking-tighter">裁剪工具</span>
                   <span className="text-[10px] text-slate-500 font-bold">拖拽选择要保留的区域</span>
                 </div>
                 <button onClick={handleCrop} disabled={!selection} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                   <Scissors size={16} /> 确认裁剪
                 </button>
               </div>
             ) : (
               <div className="w-full text-center px-10 py-1">
                 <p className="text-slate-500 text-xs font-bold italic">
                   从左侧工具栏选择功能开始编辑您的铺货图片
                 </p>
               </div>
             )}
          </div>

          {/* Global Processing Loader */}
          {isProcessing && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md">
               <div className="relative">
                 <div className="w-24 h-24 border-4 border-indigo-600/30 rounded-full animate-ping"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={40} className="text-indigo-500 animate-spin" />
                 </div>
               </div>
               <p className="mt-8 text-white font-black tracking-[0.3em] text-sm uppercase animate-pulse">AI 正在施展魔法...</p>
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
          background-position: 0 0, 0 100%, 0 0, 100% 0;
          animation: marching-ants-animation 0.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

const ToolIcon = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-2 group transition-all relative ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
  >
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
        active 
          ? 'bg-blue-600/10 shadow-[inset_0_0_15px_rgba(59,130,246,0.3)] border border-blue-500/50' 
          : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
    }`}>
      {icon}
    </div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    {active && <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>}
  </button>
);
