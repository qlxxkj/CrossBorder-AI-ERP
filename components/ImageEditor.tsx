import React, { useState, useRef, useEffect } from 'react';
import { X, Eraser, Scissors, PaintBucket, Crop, Save, Undo, Wand2, Loader2, Download } from 'lucide-react';
import { editImageWithAI } from '../services/geminiService';

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (newImageUrl: string) => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onClose, onSave }) => {
  const [currentImage, setCurrentImage] = useState<string>(imageUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  
  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      // If it's already a data URL, just return the base64 part
      if (url.startsWith('data:')) {
        return url.split(',')[1];
      }

      const response = await fetch(url, { 
        mode: 'cors',
        headers: {
          'Accept': 'image/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = () => reject(new Error("Failed to read image blob"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error fetching image for AI editing:", error);
      throw new Error("Could not access the image. This is likely due to security restrictions (CORS) on the source website. Try uploading the image manually instead.");
    }
  };

  const handleAIEdit = async (instruction: string) => {
    setIsProcessing(true);
    try {
      const base64 = await getBase64FromUrl(currentImage);
      
      // Call service
      const newImageBase64 = await editImageWithAI(base64, instruction);
      setCurrentImage(`data:image/png;base64,${newImageBase64}`);
      setActiveTool(null);
    } catch (error: any) {
      alert(error.message || "An unexpected error occurred while processing the image.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const tools = [
    { id: 'remove-bg', icon: <Scissors size={20} />, label: 'Remove BG', action: () => handleAIEdit("Remove the background and replace it with a transparent or white background.") },
    { id: 'magic-erase', icon: <Eraser size={20} />, label: 'Magic Eraser', isInput: true, placeholder: "Describe what to remove..." },
    { id: 'fill', icon: <PaintBucket size={20} />, label: 'Selection Fill', isInput: true, placeholder: "Describe what to add/change..." },
    { id: 'crop', icon: <Crop size={20} />, label: 'Auto Crop', action: () => handleAIEdit("Crop the image to center the product tightly.") },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl overflow-hidden flex shadow-2xl">
        
        {/* Sidebar Tools */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Wand2 className="text-indigo-600" size={20} /> AI Editor
          </h3>
          
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">Tools</p>
            {tools.map(tool => (
              <div key={tool.id} className="space-y-2">
                <button
                  onClick={() => {
                    if (tool.action) tool.action();
                    else setActiveTool(activeTool === tool.id ? null : tool.id);
                  }}
                  disabled={isProcessing}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                    activeTool === tool.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {isProcessing && activeTool === tool.id ? <Loader2 className="animate-spin" size={20} /> : tool.icon}
                  {tool.label}
                </button>
                
                {/* Input for prompts */}
                {tool.isInput && activeTool === tool.id && (
                  <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-inner">
                    <input
                      type="text"
                      className="w-full text-sm p-2 border border-slate-200 rounded mb-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder={tool.placeholder}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <button 
                      onClick={() => handleAIEdit(prompt)}
                      disabled={!prompt}
                      className="w-full py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-200 space-y-2">
             <button onClick={() => setCurrentImage(imageUrl)} className="w-full py-2 text-slate-500 hover:text-slate-800 text-sm flex items-center justify-center gap-2">
                <Undo size={16} /> Reset Original
             </button>
             <button 
                onClick={() => onSave(currentImage)}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2"
             >
                <Save size={18} /> Save & Close
             </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-[url('https://media.istockphoto.com/id/1303666014/vector/transparent-background-grid-seamless-pattern.jpg?s=612x612&w=0&k=20&c=6PZlB5X4a3zK3Z7G5f0M9q4Y3bZ8j2r2x4tK5o6p8=')] bg-repeat flex items-center justify-center relative overflow-hidden">
           <div className="relative shadow-2xl">
              {isProcessing && (
                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-indigo-900 font-bold">
                  <Loader2 size={48} className="animate-spin mb-2" />
                  AI is processing...
                </div>
              )}
              <img 
                src={currentImage} 
                alt="Editing" 
                className="max-w-full max-h-[70vh] object-contain"
                crossOrigin="anonymous" 
              />
           </div>
           
           <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg text-slate-500 hover:text-red-500">
             <X size={24} />
           </button>
        </div>
      </div>
    </div>
  );
};