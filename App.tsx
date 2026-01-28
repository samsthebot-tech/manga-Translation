
import React, { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Upload, 
  FileImage, 
  Settings, 
  Play, 
  Download, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Layers,
  Trash2
} from 'lucide-react';
import { MangaPage, ProcessingOptions, ProcessingLog } from './types';
import { processMangaPage } from './services/geminiService';

export default function App() {
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [range, setRange] = useState({ start: 1, end: 10 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState<ProcessingOptions>({
    colorize: true,
    translate: true,
    targetLanguage: 'English',
    quality: 'high'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [{ timestamp: new Date(), message, type }, ...prev].slice(0, 50));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`Scanning file: ${file.name}`);
    
    try {
      let newPages: MangaPage[] = [];

      if (file.name.toLowerCase().endsWith('.zip')) {
        // Load ZIP with support for non-English filenames (JSZip handles UTF-8 by default)
        const zip = await JSZip.loadAsync(file);
        
        // Define supported formats
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
        
        // Recursive search & filtering logic
        // Type cast zip.files values to JSZip.JSZipObject to fix TS unknown errors
        const imageEntries = (Object.values(zip.files) as any[]).filter((entry: JSZip.JSZipObject) => {
          if (entry.dir) return false; // Ignore directories
          
          const pathParts = entry.name.split('/');
          const filename = pathParts[pathParts.length - 1];
          
          // Ignore hidden files (starts with .)
          if (filename.startsWith('.')) return false;
          
          // Ignore system folders like __MACOSX
          if (entry.name.includes('__MACOSX')) return false;
          
          // Case-insensitive extension check
          const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
          return validExtensions.includes(ext);
        }) as JSZip.JSZipObject[];

        if (imageEntries.length === 0) {
          addLog(`No valid images found in ${file.name}. Check formats (JPG, PNG, WEBP, BMP).`, 'error');
          return;
        }

        // Natural Alphanumeric Sort (handles 1.jpg, 2.jpg, 10.jpg correctly)
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        imageEntries.sort((a, b) => collator.compare(a.name, b.name));

        addLog(`Found ${imageEntries.length} images. Extracting...`);

        for (const entry of imageEntries) {
          const content = await entry.async('base64');
          newPages.push({
            id: crypto.randomUUID(),
            name: entry.name,
            originalUrl: `data:image/png;base64,${content}`,
            base64: content,
            status: 'pending'
          });
        }
      } else {
        // Handle single image upload
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          setPages([{
            id: crypto.randomUUID(),
            name: file.name,
            originalUrl: base64,
            base64: base64,
            status: 'pending'
          }]);
        };
        reader.readAsDataURL(file);
        return;
      }

      setPages(newPages);
      setRange({ start: 1, end: Math.min(newPages.length, 10) });
      addLog(`Loaded ${newPages.length} pages successfully. Ready to process.`, 'success');
    } catch (err) {
      addLog(`Failed to extract zip: ${err}`, 'error');
      console.error(err);
    }
  };

  const startProcessing = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    addLog(`Starting batch process for pages ${range.start} to ${range.end}...`);

    const toProcess = pages.slice(range.start - 1, range.end);
    
    for (let i = 0; i < toProcess.length; i++) {
      const page = toProcess[i];
      
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'processing' } : p));
      addLog(`Processing [${i + 1}/${toProcess.length}]: ${page.name}`);

      try {
        const resultUrl = await processMangaPage(page.base64, {
          colorize: options.colorize,
          translate: options.translate,
          targetLanguage: options.targetLanguage
        });

        setPages(prev => prev.map(p => p.id === page.id ? { 
          ...p, 
          status: 'completed', 
          processedUrl: resultUrl 
        } : p));
        
        addLog(`Completed: ${page.name}`, 'success');
        
        // Automatic high-quality download after processing
        downloadImage(resultUrl, page.name);
        
      } catch (err) {
        addLog(`Error processing ${page.name}: ${err}`, 'error');
        setPages(prev => prev.map(p => p.id === page.id ? { 
          ...p, 
          status: 'error', 
          error: String(err) 
        } : p));
      }
    }

    setIsProcessing(false);
    addLog('Batch processing completed.', 'success');
  };

  const clearPages = () => {
    setPages([]);
    setLogs([]);
    addLog('Workspace cleared.');
  };

  const downloadImage = (url: string, filename: string) => {
    // Extract base filename without path
    const cleanName = filename.split('/').pop() || filename;
    const link = document.createElement('a');
    link.href = url;
    link.download = `manga_flow_${cleanName}`;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              MangaFlow AI
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full text-sm font-medium transition-all"
            >
              <Upload className="w-4 h-4" />
              Upload ZIP
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".zip,image/*" 
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <aside className="lg:col-span-4 space-y-6">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-4">
              <Settings className="w-5 h-5" />
              <h2>Processing Engine</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">
                  Enhancement Pipeline
                </label>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/50 transition-colors cursor-pointer">
                    <span className="text-sm">Realistic Colorization</span>
                    <input 
                      type="checkbox" 
                      checked={options.colorize} 
                      onChange={e => setOptions({...options, colorize: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500" 
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/50 transition-colors cursor-pointer">
                    <span className="text-sm">AI Translation Overlay</span>
                    <input 
                      type="checkbox" 
                      checked={options.translate} 
                      onChange={e => setOptions({...options, translate: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500" 
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">
                  Target Language
                </label>
                <select 
                  value={options.targetLanguage}
                  onChange={e => setOptions({...options, targetLanguage: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>Chinese</option>
                  <option>Japanese</option>
                  <option>Korean</option>
                  <option>German</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider flex justify-between">
                  Page Range Selection <span>{pages.length > 0 ? `Total: ${pages.length}` : '-'}</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={range.start} 
                    min={1}
                    max={pages.length || 1}
                    onChange={e => setRange({...range, start: Math.max(1, parseInt(e.target.value) || 1)})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Start"
                  />
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                  <input 
                    type="number" 
                    value={range.end} 
                    min={range.start}
                    max={pages.length || 1}
                    onChange={e => setRange({...range, end: Math.min(pages.length || 1, parseInt(e.target.value) || 1)})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="End"
                  />
                </div>
              </div>

              <button 
                onClick={startProcessing}
                disabled={isProcessing || pages.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all shadow-lg ${
                  isProcessing || pages.length === 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/20 active:scale-95'
                }`}
              >
                {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                {isProcessing ? 'Processing...' : 'Run Pipeline'}
              </button>
            </div>
          </section>

          {/* Logs */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">System Logs</h3>
              <button onClick={clearPages} className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                <Trash2 className="w-3 h-3" />
                Reset
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono scrollbar-hide">
              {logs.length === 0 && <p className="text-gray-600 italic">Waiting for uploads...</p>}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-2 p-2 rounded ${
                  log.type === 'error' ? 'bg-red-500/10 text-red-400' : 
                  log.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400'
                }`}>
                  <span className="opacity-30 flex-shrink-0">{log.timestamp.toLocaleTimeString([], { hour12: false })}</span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Results Area */}
        <section className="lg:col-span-8 space-y-6">
          {pages.length === 0 ? (
            <div className="h-full min-h-[600px] border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-12 text-center bg-white/[0.02]">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                <FileImage className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Workspace Empty</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-8">
                Drop a ZIP file with your manga pages here. We'll find all images recursively and keep them in order.
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-3 rounded-2xl font-semibold transition-all"
              >
                Select Files
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 pb-20">
              {pages.map((page, idx) => {
                const isVisible = (idx + 1) >= range.start && (idx + 1) <= range.end;
                // Keep showing completed pages even if they fall out of range
                if (!isVisible && page.status !== 'completed') return null;

                return (
                  <div key={page.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-medium truncate max-w-[250px]" title={page.name}>
                            {page.name.split('/').pop()}
                          </h4>
                          <span className={`text-[10px] font-bold uppercase tracking-tight ${
                            page.status === 'completed' ? 'text-emerald-500' :
                            page.status === 'processing' ? 'text-indigo-400' :
                            page.status === 'error' ? 'text-red-400' : 'text-gray-600'
                          }`}>
                            {page.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {page.status === 'completed' && (
                          <button 
                            onClick={() => downloadImage(page.processedUrl!, page.name)}
                            className="p-2 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors flex items-center gap-2 text-xs"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        )}
                        {page.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-400 text-xs">
                            <AlertCircle className="w-4 h-4" />
                            Failed
                          </div>
                        )}
                        {page.status === 'processing' && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full">
                            <RefreshCcw className="w-3 h-3 text-indigo-400 animate-spin" />
                            <span className="text-[10px] text-indigo-400 font-bold uppercase">Processing</span>
                          </div>
                        )}
                        {page.status === 'completed' && (
                          <div className="p-1 bg-emerald-500/10 rounded-full">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
                      <div className="relative aspect-[3/4] bg-black">
                        <img src={page.originalUrl} alt="Original" className="w-full h-full object-contain" loading="lazy" />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] uppercase font-bold text-white/50 border border-white/10">
                          Original
                        </div>
                      </div>
                      <div className="relative aspect-[3/4] bg-black">
                        {page.status === 'completed' ? (
                          <>
                            <img src={page.processedUrl} alt="Processed" className="w-full h-full object-contain animate-in fade-in duration-700" />
                            <div className="absolute top-2 left-2 bg-indigo-600/80 backdrop-blur px-2 py-1 rounded text-[10px] uppercase font-bold text-white border border-white/20">
                              Enhanced
                            </div>
                          </>
                        ) : page.status === 'processing' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                            <div className="relative">
                              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            </div>
                            <p className="text-xs text-gray-500 animate-pulse">Running AI Inference...</p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-700 bg-white/[0.01]">
                            <Layers className="w-12 h-12 opacity-20" />
                          </div>
                        )}
                        {page.error && (
                          <div className="absolute inset-0 bg-red-950/20 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                            <div className="bg-red-900/40 p-4 rounded-2xl border border-red-500/50">
                              <p className="text-xs text-red-200">{page.error}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Disclaimer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-sm border-t border-white/5 flex justify-center pointer-events-none z-50">
        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <p className="text-[10px] font-medium text-gray-400 tracking-tight uppercase">
            No Censorship Filters Active • Raw Pixel Stream • Local Processing Mode
          </p>
        </div>
      </footer>
    </div>
  );
}
