import React, { useState, useRef } from 'react';
import { Outfit } from './types';
import { Upload, X, Loader2, ImagePlus, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setOutfits([]);
      setError(null);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setOutfits([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeImage = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/analyze-item', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to analyze image');
      }

      const data = await response.json();
      setOutfits(data.outfits || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateImageForOutfit = async (outfitId: string, visualPrompt: string) => {
    // Set loading state for this specific outfit
    setOutfits(prev => prev.map(o => o.id === outfitId ? { ...o, isLoadingImage: true } : o));

    try {
      const formData = new FormData();
      formData.append('visualPrompt', visualPrompt);
      if (file) {
        formData.append('image', file);
      }

      const response = await fetch('/api/generate-outfit-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      setOutfits(prev => prev.map(o => o.id === outfitId ? { ...o, imageUrl: data.imageUrl, isLoadingImage: false } : o));
    } catch (err: any) {
      console.error(err);
      setOutfits(prev => prev.map(o => o.id === outfitId ? { ...o, isLoadingImage: false } : o));
      // Show some error toast or silently fail? Silent fail is easier for this.
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F0ED] text-[#2C2C2A] font-sans selection:bg-[#E0E0DB]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        
        {/* Header */}
        <header className="mb-16 text-center space-y-4">
          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-[#2C2C2A] rounded-full flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
          </motion.div>
          <motion.h1 
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-heading tracking-tight"
          >
            Virtual Stylist
          </motion.h1>
          <motion.p 
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-[#6B6B65] max-w-2xl mx-auto"
          >
            Upload a difficult-to-match clothing item, and let AI generate complete outfit combinations.
          </motion.p>
        </header>

        {/* Upload Section */}
        <div className="max-w-xl mx-auto mb-20">
          <AnimatePresence mode="wait">
            {!previewUrl ? (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative h-72 rounded-3xl border-2 border-dashed border-[#C0C0B9] bg-[#EAEAEA] hover:bg-[#E4E4E1] transition-colors overflow-hidden"
              >
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 mb-4 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#2C2C2A] group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="font-medium text-lg mb-1 font-heading">Upload an Item</h3>
                  <p className="text-[#6B6B65] text-sm max-w-[250px]">
                    Drop an image of a skirt, pants, top, or shoes you don't know how to style.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-4 rounded-3xl shadow-sm border border-[#E0E0DB]"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#F0F0ED]">
                  <img src={previewUrl} alt="Item preview" className="w-full h-full object-contain" />
                  <button 
                    onClick={handleClearFile}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="flex w-full items-center justify-center gap-2 bg-[#2C2C2A] text-white px-8 py-4 rounded-2xl font-medium hover:bg-black transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Style...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Outfits
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <div className="mt-4 p-4 text-red-600 bg-red-50 rounded-xl text-sm text-center">
                    {error}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Results Section */}
        {outfits.length > 0 && (
          <div className="space-y-16 pb-16">
            <h2 className="text-3xl font-heading text-center tracking-tight mb-12">Your Curated Looks</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {outfits.map((outfit, index) => (
                <motion.div
                  key={outfit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.15 }}
                  className="flex flex-col bg-white rounded-3xl overflow-hidden border border-[#E0E0DB] shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Image Area */}
                  <div className="relative aspect-[3/4] bg-[#F8F8F6] border-b border-[#E0E0DB]">
                    {outfit.imageUrl ? (
                      <img src={outfit.imageUrl} alt={outfit.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        {outfit.isLoadingImage ? (
                          <>
                            <Loader2 className="w-8 h-8 text-[#2C2C2A] animate-spin mb-4" />
                            <p className="text-sm text-[#6B6B65]">Generating visualization...</p>
                          </>
                        ) : (
                          <>
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#6B6B65] shadow-sm mb-4">
                              <ImagePlus className="w-6 h-6" />
                            </div>
                            <p className="text-sm text-[#6B6B65] mb-4">Ready to visualize this look?</p>
                            <button
                              onClick={() => generateImageForOutfit(outfit.id, outfit.visualPrompt)}
                              className="px-4 py-2 bg-[#F0F0ED] hover:bg-[#EAEAEA] text-[#2C2C2A] rounded-full text-sm font-medium transition-colors"
                            >
                              Visualize Flat-lay
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Info Area */}
                  <div className="p-6 md:p-8 flex-1 flex flex-col">
                    <div className="uppercase tracking-widest text-xs font-semibold text-[#8B8B88] mb-2">{outfit.type}</div>
                    <h3 className="font-heading text-2xl font-medium mb-3">{outfit.title}</h3>
                    <p className="text-[#6B6B65] text-sm leading-relaxed mb-6">{outfit.description}</p>
                    
                    <div className="mt-auto">
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-[#2C2C2A] mb-3">Pair With</h4>
                      <ul className="space-y-2 mb-6">
                        {outfit.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#4c4c4a]">
                            <CheckCircle2 className="w-4 h-4 text-[#C0C0B9] shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="flex gap-2">
                        {outfit.colorPalette.map((color, i) => (
                          <div 
                            key={i} 
                            style={{ backgroundColor: color }}
                            className="w-8 h-8 rounded-full border border-black/5 shadow-sm"
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
