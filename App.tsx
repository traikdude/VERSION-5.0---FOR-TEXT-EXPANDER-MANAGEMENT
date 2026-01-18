import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Copy, Check, Terminal, X, LayoutTemplate, LayoutGrid, List, Filter, ChevronLeft, ChevronRight, RefreshCw, Star, Trash2, Save, Plus, AlertTriangle, Clock, Ban, Wifi, WifiOff, RotateCcw, Settings, ExternalLink, FileText, LayoutDashboard, Github, FolderOpen, Database, Sparkles, Wrench, Trash, Play, HardDrive, BarChart2, Info, HelpCircle, Download, Upload, Cloud, FileJson, FileType } from 'lucide-react';
import { EXPANSIONS_DATA, LETTER_STYLES } from './data';
import { LanguageCategory, ShortcutData } from './types';

// --- CONFIG: Backend Constraints ---
const LIMITS = {
  MAX_KEY_LEN: 80,
  MAX_FIELD_LEN: 50000,
  MAX_TAGS_LEN: 512,
  MAX_LANGUAGE_LEN: 64,
  MAX_APP_LEN: 128,
  MAX_DESC_LEN: 2000,
};

// --- UTILITIES: GAS Bridge & Retry Logic ---

/**
 * Promisifies a Google Apps Script call with timeout support.
 */
const runGas = (funcName: string, args: any[] = [], timeout = 60000): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.google?.script) {
      reject(new Error("GAS_UNAVAILABLE"));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("TIMEOUT"));
    }, timeout);

    window.google.script.run
      .withSuccessHandler((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .withFailureHandler((err) => {
        clearTimeout(timer);
        reject(err);
      })
      // @ts-ignore
      [funcName](...args);
  });
};

/**
 * Executes a function with exponential backoff retry logic.
 */
const withRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    if (retries === 0 || err.message === "GAS_UNAVAILABLE" || err.message === "CANCELLED") throw err;
    console.warn(`Operation failed. Retrying in ${delay}ms... (${retries} attempts left)`);
    await new Promise(res => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
};

const getFriendlyError = (error: any) => {
  const msg = error?.message || String(error);
  if (msg.includes('TIMEOUT')) return { title: 'Connection Timeout', desc: 'The server took too long to respond. Your network might be slow.' };
  if (msg.includes('NetworkError') || msg.includes('we were unable to connect')) return { title: 'Network Failure', desc: 'Unable to connect to Google. Please check your internet connection.' };
  if (msg === 'GAS_UNAVAILABLE') return { title: 'Environment Error', desc: 'Not running inside Google Apps Script.' };
  if (msg === 'CANCELLED') return { title: 'Cancelled', desc: 'Operation cancelled by user.' };
  return { title: 'Sync Error', desc: msg };
};

// --- COMPONENTS ---

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  const bgColors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };
  const Icons = {
    success: Check,
    error: AlertTriangle,
    info: Terminal
  };
  const Icon = Icons[type];

  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`${bgColors[type]} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in backdrop-blur-sm z-50 border border-white/10`}>
      <Icon size={20} />
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
};

interface LoadingMetrics {
  startTime: number;
  itemsLoaded: number;
  totalItems: number;
}

const LoadingOverlay = ({ 
  progress, 
  total, 
  status, 
  onCancel, 
  startTime,
  error,
  onRetry
}: { 
  progress: number, 
  total: number, 
  status: string, 
  onCancel: () => void,
  startTime: number,
  error?: { title: string, desc: string } | null,
  onRetry?: () => void
}) => {
  // Calculate Metrics
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const itemsPerSecond = elapsedSeconds > 0 ? progress / elapsedSeconds : 0;
  const remainingItems = total - progress;
  const etaSeconds = itemsPerSecond > 0 ? remainingItems / itemsPerSecond : 0;
  const percent = total > 0 ? Math.min(100, (progress / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-all duration-300">
      <div className={`bg-slate-800 p-8 rounded-2xl shadow-2xl border ${error ? 'border-red-500/50' : 'border-white/10'} max-w-md w-full relative overflow-hidden transition-colors duration-300`}>
        {/* Decorative background glow */}
        <div className={`absolute top-0 left-0 w-full h-1 ${error ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-pulse'}`}></div>
        
        <div className="flex flex-col items-center text-center">
          
          {error ? (
            <div className="mb-6 relative">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                <AlertTriangle size={40} className="text-red-500" />
              </div>
            </div>
          ) : (
            <div className="mb-6 relative">
              <div className="w-20 h-20 border-4 border-slate-700 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-white">
                {Math.round(percent)}%
              </div>
            </div>
          )}

          <h3 className="text-xl font-bold text-white mb-2">
            {error ? error.title : 'Synchronizing Database'}
          </h3>
          
          <p className={`${error ? 'text-red-300' : 'text-purple-200/70'} mb-6 text-sm ${!error && 'animate-pulse'}`}>
            {error ? error.desc : status}
          </p>
          
          {/* Progress Bar (Hide on error if 0 progress, show partial if resumption possible) */}
          {!error && (
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2 overflow-hidden relative">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500 ease-out rounded-full relative"
                style={{ width: `${percent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
          )}
          
          {/* Metrics Grid */}
          {!error && (
            <div className="grid grid-cols-2 gap-4 w-full mt-4 mb-6">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center">
                <span className="text-xs text-purple-300/50 uppercase tracking-wider mb-1">Progress</span>
                <span className="font-mono font-bold text-white">{progress.toLocaleString()} / {total.toLocaleString()}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center">
                <span className="text-xs text-purple-300/50 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={10}/> Est. Time</span>
                <span className="font-mono font-bold text-white">
                  {total === 0 ? '--' : etaSeconds < 60 ? `${Math.ceil(etaSeconds)}s` : `${Math.ceil(etaSeconds/60)}m`}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 w-full justify-center mt-2">
            {error && onRetry && (
              <button 
                onClick={onRetry}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
              >
                <RotateCcw size={16} /> Retry Sync
              </button>
            )}
            <button 
              onClick={onCancel}
              className={`${error ? 'text-slate-400 hover:text-white' : 'text-red-400 hover:text-white hover:bg-red-500/10'} px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
            >
              <Ban size={16} /> {error ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  isDeleting 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Partial<ShortcutData>) => void; 
  initialData: Partial<ShortcutData> | null;
  isDeleting?: (key: string) => void; 
}) => {
  const [formData, setFormData] = useState<Partial<ShortcutData>>({ k: '', e: '', s: 'all', d: '', tags: '' });
  const [errors, setErrors] = useState<{k?: string, e?: string}>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || { k: '', e: '', s: 'all', d: '', tags: '' });
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validate = () => {
    const newErrors: {k?: string, e?: string} = {};
    if (!formData.k) newErrors.k = 'Trigger is required';
    if (formData.k && formData.k.length > LIMITS.MAX_KEY_LEN) newErrors.k = `Max ${LIMITS.MAX_KEY_LEN} chars`;
    if (!formData.e) newErrors.e = 'Content is required';
    if (formData.e && formData.e.length > LIMITS.MAX_FIELD_LEN) newErrors.e = 'Content too long';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
          <h3 className="text-xl font-bold text-white">{initialData?.k ? 'Edit Shortcut' : 'New Shortcut'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <div className="flex justify-between">
              <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Trigger (Key)</label>
              {errors.k && <span className="text-xs text-red-400">{errors.k}</span>}
            </div>
            <input 
              type="text" 
              value={formData.k} 
              onChange={e => setFormData(prev => ({ ...prev, k: e.target.value }))}
              className={`w-full bg-slate-900 border ${errors.k ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono transition-colors`}
              placeholder="e.g. omw"
              readOnly={!!initialData?.k}
            />
          </div>
          
          <div>
            <div className="flex justify-between">
              <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Content (Expansion)</label>
              {errors.e && <span className="text-xs text-red-400">{errors.e}</span>}
            </div>
            <textarea 
              value={formData.e} 
              onChange={e => setFormData(prev => ({ ...prev, e: e.target.value }))}
              className={`w-full bg-slate-900 border ${errors.e ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px] transition-colors`}
              placeholder="Text to expand..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Language</label>
              <select 
                value={formData.s}
                onChange={e => setFormData(prev => ({ ...prev, s: e.target.value as LanguageCategory }))}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="all">All</option>
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Type / Desc</label>
              <input 
                type="text" 
                value={formData.d || ''} 
                onChange={e => setFormData(prev => ({ ...prev, d: e.target.value }))}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="e.g. greeting"
                maxLength={LIMITS.MAX_DESC_LEN}
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-slate-800/50 flex justify-between">
          {initialData?.k && isDeleting ? (
            <button 
              onClick={() => isDeleting(initialData.k!)}
              className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <Trash2 size={18} /> Delete
            </button>
          ) : <div></div>}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
            <button 
              onClick={handleSubmit}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg shadow-lg shadow-purple-500/20 font-bold flex items-center gap-2"
            >
              <Save size={18} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImportModal = ({
  isOpen,
  onClose,
  onImport
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (mode: 'csv' | 'json', text: string) => void;
}) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'csv' | 'json'>('csv');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload size={20} className="text-blue-400" /> Bulk Import
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setMode('csv')}
              className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'csv' ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              <FileType size={16} /> CSV
            </button>
            <button
              onClick={() => setMode('json')}
              className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'json' ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              <FileJson size={16} /> JSON
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase mb-1">
              Paste Data ({mode.toUpperCase()})
            </label>
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none min-h-[200px] font-mono text-sm custom-scrollbar"
              placeholder={mode === 'csv' ? "Key,Expansion,Application,Description,Language,Tags" : '[{"key":"example","expansion":"content"}]'}
            />
          </div>
          
          <p className="text-xs text-slate-500">
            {mode === 'csv' 
              ? 'Format: Key, Expansion, [App], [Desc], [Lang], [Tags]' 
              : 'Format: Array of objects with "key" and "expansion" properties.'}
          </p>
        </div>

        <div className="p-6 border-t border-white/10 bg-slate-800/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
          <button 
            onClick={() => {
                if(text.trim()) onImport(mode, text);
            }}
            disabled={!text.trim()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg shadow-lg shadow-blue-500/20 font-bold flex items-center gap-2"
          >
            <Upload size={18} /> Import
          </button>
        </div>
      </div>
    </div>
  );
};

// --- LOGIC: Inference & Filters ---

const TYPE_FILTERS: Record<string, { label: string, keywords: string[] }> = {
  dates: { label: '📅 Dates', keywords: ['date', 'month', 'year', 'calendar', 'time'] },
  numbers: { label: '🔢 Numbers', keywords: ['number', 'numeric', 'digit', 'math', 'count'] },
  greetings: { label: '👋 Greetings', keywords: ['greeting', 'hello', 'hi', 'morning', 'night', 'bye', 'welcome'] },
  symbols: { label: '✨ Symbols', keywords: ['symbol', 'arrow', 'shape', 'star', 'heart', 'check'] },
  kaomoji: { label: '😊 Kaomoji', keywords: ['kaomoji', 'face', 'emoticon', 'lenny'] },
  email: { label: '📧 Email', keywords: ['email', 'mail', 'contact', 'address'] },
  zodiac: { label: '♈ Zodiac', keywords: ['zodiac', 'horoscope', 'sign'] },
  general: { label: '📁 General', keywords: ['general', 'misc', 'other'] }
};

const inferDescription = (item: ShortcutData): string => {
  if (item.d) return item.d.toLowerCase();
  
  const k = item.k.toLowerCase();
  const style = (item.style || '').toLowerCase();

  if (style.includes('kaomoji')) return 'kaomoji';
  if (style.includes('symbols') || style.includes('stars') || style.includes('hearts') || style.includes('ancient') || style.includes('esoteric')) return 'symbols';
  if (k.includes('@') || k.includes('mail') || k.includes('.com')) return 'email';
  
  return 'general';
};

// --- MAIN APPLICATION ---

export default function TextExpansionManager() {
  // Data State
  const [data, setData] = useState<ShortcutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadStatus, setLoadStatus] = useState('Initializing...');
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
  const [loadStartTime, setLoadStartTime] = useState(0);
  const [isGasEnvironment, setIsGasEnvironment] = useState(false);
  
  // Error & Resume State
  const [syncError, setSyncError] = useState<{ title: string, desc: string } | null>(null);
  const snapshotState = useRef<{ token: string | null, offset: number, total: number }>({ token: null, offset: 0, total: 0 });
  
  // Abort Control
  const syncAbortController = useRef<AbortController | null>(null);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<LanguageCategory>('all');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all'); // NEW: Main Category
  const [viewMode, setViewMode] = useState('grid');
  
  // Dropdown States
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: 'success' | 'error' | 'info' }>>([]);
  const [editingItem, setEditingItem] = useState<Partial<ShortcutData> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // --- Initialization & Data Sync ---

  useEffect(() => {
    const isGas = typeof window !== 'undefined' && window.google && window.google.script;
    setIsGasEnvironment(!!isGas);

    if (isGas) {
      startGasSync();
    } else {
      console.log('Local environment detected. Using static data.');
      setData(EXPANSIONS_DATA);
      setLoading(false);
    }
  }, []);

  const startGasSync = async () => {
    setLoading(true);
    setSyncError(null);
    setLoadStartTime(Date.now());
    setLoadStatus('Connecting to backend...');
    
    // Reset snapshot state
    snapshotState.current = { token: null, offset: 0, total: 0 };
    syncAbortController.current = new AbortController();

    try {
      // 1. Bootstrap
      const bootstrap = await withRetry(() => runGas('getAppBootstrapData', []));
      if (!bootstrap.ok) throw new Error(bootstrap.message || "Bootstrap failed");

      // 2. Start Snapshot
      setLoadStatus('Preparing snapshot...');
      const snapshot = await withRetry(() => runGas('beginShortcutsSnapshotHandler', []));
      if (!snapshot.ok) throw new Error(snapshot.message || "Snapshot failed");

      const { snapshotToken, total, shortcuts, hasMore, offset } = snapshot;
      
      // Update Resume State
      snapshotState.current = { token: snapshotToken, offset, total: total || 0 };

      const normalized = normalizeShortcuts(shortcuts);
      setData(normalized);
      setLoadProgress({ current: normalized.length, total: total || 0 });

      if (hasMore) {
        await fetchNextBatch(snapshotToken, offset, total);
      } else {
        finishLoading();
      }

    } catch (err: any) {
      handleSyncError(err);
    }
  };

  const fetchNextBatch = async (token: string, offset: number, total: number) => {
    if (syncAbortController.current?.signal.aborted) throw new Error("CANCELLED");

    setLoadStatus(`Fetching batch starting at ${offset}...`);

    try {
      // Updated: Use fetchShortcutsBatch from uiHandlers.gs
      const response = await withRetry(() => runGas('fetchShortcutsBatch', [token, offset, 500])); // Larger batch for speed
      
      if (!response.ok) throw new Error(response.message);

      if (syncAbortController.current?.signal.aborted) throw new Error("CANCELLED");

      // Update Resume State
      snapshotState.current = { token, offset: response.offset, total };

      setData(prev => {
        const newData = [...prev, ...normalizeShortcuts(response.shortcuts)];
        setLoadProgress({ current: newData.length, total: total });
        return newData;
      });

      if (response.hasMore) {
        // Recursive call
        await fetchNextBatch(token, response.offset, total);
      } else {
        finishLoading();
      }
    } catch (err) {
      throw err; // Propagate to main catch
    }
  };

  const handleSyncError = (err: any) => {
    if (err.message === "CANCELLED") {
      setLoading(false);
      showToast('Sync cancelled by user', 'info');
    } else {
      const friendly = getFriendlyError(err);
      setSyncError(friendly);
      // Keep loading=true to show overlay with error
    }
  };

  const handleRetrySync = () => {
    setSyncError(null);
    const { token, offset, total } = snapshotState.current;
    
    // Resume if we have a token, otherwise restart
    if (token) {
      // Re-create abort controller
      syncAbortController.current = new AbortController();
      fetchNextBatch(token, offset, total).catch(handleSyncError);
    } else {
      startGasSync();
    }
  };

  const finishLoading = () => {
    setLoading(false);
    showToast('All shortcuts synced successfully', 'success');
  };

  const cancelSync = () => {
    if (syncAbortController.current) {
      syncAbortController.current.abort();
    }
    setLoading(false);
    setSyncError(null);
  };

  const normalizeShortcuts = (raw: any[]): ShortcutData[] => {
    return raw.map(item => ({
      k: item.key || '',
      e: item.expansion || '',
      s: (item.language && item.language.toLowerCase().includes('span')) ? 'spanish' : 
         (item.language && item.language.toLowerCase().includes('eng')) ? 'english' : 'all',
      style: item.style || item.fontStyle || '', // Use mapped style from backend if available
      d: item.description || '',
      tags: item.tags,
      application: item.application,
      favorite: !!item.favorite,
      // Map extra backend fields
      mainCategory: item.mainCategory,
      subcategory: item.subcategory,
      platform: item.platform,
      usageFrequency: item.usageFrequency,
      updatedAt: item.updatedAt
    }));
  };

  // --- MASTER Automation Tools (Proxies) ---
  const handleMasterAction = (action: keyof typeof window.google.script.run) => {
    if (!isGasEnvironment) {
      showToast('Available in Google Apps Script only', 'info');
      return;
    }
    setShowToolsDropdown(false);
    runGas(action as string).catch(err => {
      console.error(err);
      showToast('Failed to launch tool', 'error');
    });
  };

  // Handler for actions that return status/data (Maintenance/Cache)
  const handleMaintenanceAction = async (action: string, label: string) => {
    if (!isGasEnvironment) {
      showToast('Available in Google Apps Script only', 'info');
      return;
    }
    setShowToolsDropdown(false);
    setLoading(true);
    setLoadStatus(`Running ${label}...`);
    
    try {
      const res = await withRetry(() => runGas(action));
      if (res && (res.ok || res.success)) {
        let detail = '';
        if (res.removed !== undefined) detail = `Removed ${res.removed} items`;
        else if (res.cached !== undefined) detail = `Cached ${res.cached} items`;
        else if (res.folderUrl) detail = 'Folder created successfully';
        else if (res.message) detail = res.message;
        
        showToast(`${label} Successful. ${detail}`, 'success');
        
        // If data was modified, reload
        if (action.includes('cleanup') || action.includes('Cache') || action.includes('restore') || action.includes('Import')) {
           handleRetrySync(); 
        } else {
           setLoading(false);
        }
      } else {
        throw new Error(res?.message || 'Operation failed');
      }
    } catch (err: any) {
      showToast(`${label} Failed: ${err.message}`, 'error');
      setLoading(false);
    }
  };

  const handleImport = async (mode: 'csv' | 'json', text: string) => {
    if (!isGasEnvironment) {
      showToast('Import only available in GAS environment', 'info');
      return;
    }
    setIsImportModalOpen(false);
    setLoading(true);
    setLoadStatus(`Importing ${mode.toUpperCase()} data...`);

    try {
      const res = await withRetry(() => runGas('bulkImport', [{ mode, text }]));
      if (res && res.ok) {
        showToast(`Import Success: ${res.inserted} inserted, ${res.updated} updated.`, 'success');
        if (res.errors && res.errors.length > 0) {
            setTimeout(() => showToast(`Warning: ${res.errors.length} rows failed validation.`, 'info'), 3000);
        }
        handleRetrySync();
      } else {
        throw new Error(res?.message || 'Import failed');
      }
    } catch (err: any) {
      showToast(`Import Failed: ${err.message}`, 'error');
      setLoading(false);
    }
  };

  // --- CRUD Operations with Optimistic UI & Rollback ---

  const handleSave = async (item: Partial<ShortcutData>) => {
    // Basic validation logic moved to EditModal, but keep safety check here
    if (!item.k || !item.e) {
      showToast('Trigger and Expansion are required', 'error');
      return;
    }

    const payload = {
      key: item.k,
      expansion: item.e,
      language: item.s === 'all' ? '' : item.s,
      description: item.d,
      tags: item.tags,
      application: item.application,
      mainCategory: item.mainCategory,
      subcategory: item.subcategory,
      fontStyle: item.style, // Map style back to fontStyle
      platform: item.platform,
      usageFrequency: item.usageFrequency
    };

    const previousData = [...data]; // Backup

    // Optimistic Update
    setData(prev => {
      const idx = prev.findIndex(i => i.k === item.k);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...item } as ShortcutData;
        return next;
      }
      return [{ ...item } as ShortcutData, ...prev];
    });

    setIsEditModalOpen(false);

    if (isGasEnvironment) {
      try {
        // Updated: Use upsertShortcut from uiHandlers.gs
        const res = await withRetry(() => runGas('upsertShortcut', [payload]));
        if (!res.ok) throw new Error(res.message);
        showToast(res.message || 'Shortcut saved', 'success');
      } catch (err: any) {
        setData(previousData); // Rollback
        handleError('Save failed - changes reverted', err);
      }
    } else {
      showToast('Saved (Local Mode)', 'success');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this shortcut?')) return;

    const previousData = [...data]; // Backup
    setData(prev => prev.filter(i => i.k !== key));
    setIsEditModalOpen(false);

    if (isGasEnvironment) {
      try {
        // Updated: Use deleteShortcut from uiHandlers.gs, passing key string directly
        const res = await withRetry(() => runGas('deleteShortcut', [key]));
        if (!res.ok) throw new Error(res.message);
        showToast('Shortcut deleted', 'success');
      } catch (err: any) {
        setData(previousData); // Rollback
        handleError('Delete failed - changes reverted', err);
      }
    } else {
      showToast('Deleted (Local Mode)', 'success');
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, item: ShortcutData) => {
    e.stopPropagation();
    
    // Optimistic
    setData(prev => prev.map(i => i.k === item.k ? { ...i, favorite: !i.favorite } : i));

    if (isGasEnvironment) {
      // Use toggleFavorite if defined, or assume backend handles simple toggle or add
      // Given comments, we assume 'toggleFavoriteHandler' or specific logic exists or we can't reliably toggle easily without separate Add/Remove
      // Reverting to 'toggleFavorite' assuming user has favorites.gs
      runGas('toggleFavorite', [item.k]).catch(err => {
        console.error("Fav toggle failed", err);
      });
    }
  };

  const handleError = (msg: string, err: any) => {
    console.error(msg, err);
    showToast(`${msg}: ${err.message || 'Unknown error'}`, 'error');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  };

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => setCopiedId(null), 2000);

      if (isGasEnvironment) {
        // Find item to get correct Key
        const item = data.find((_, idx) => `${_.k}-${idx}` === id);
        if (item) {
           // Updated: Handle return value from clipboard favorite
           runGas('handleClipboardFavorite', [item.k])
             .then(res => {
                if(res.ok && res.favorite) {
                    // Update UI to show favorite if backend confirmed
                    setData(prev => prev.map(i => i.k === item.k ? { ...i, favorite: true } : i));
                }
             })
             .catch(e => console.log('Auto-fav failed', e));
        }
      }
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
  }, [isGasEnvironment, data]);

  // --- Filtering & Stats ---

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = searchTerm === '' || 
        item.k.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.e.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = activeFilter === 'all' || item.s === activeFilter;
      const matchesStyle = activeStyle === 'all' ? true : item.style === activeStyle;
      const matchesCategory = activeCategory === 'all' ? true : item.mainCategory === activeCategory;
      
      let matchesType = true;
      if (activeType !== 'all') {
        const keywords = TYPE_FILTERS[activeType].keywords;
        const desc = inferDescription(item);
        matchesType = keywords.some(kw => desc.includes(kw));
      }
      
      return matchesSearch && matchesFilter && matchesStyle && matchesType && matchesCategory;
    });
  }, [data, searchTerm, activeFilter, activeStyle, activeType, activeCategory]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeFilter, activeStyle, activeType, activeCategory]);

  const stats = useMemo(() => ({
    total: data.length,
    english: data.filter(i => i.s === 'english').length,
    spanish: data.filter(i => i.s === 'spanish').length,
    styles: new Set(data.map(i => i.style)).size,
    // Extract unique categories for filter
    uniqueCategories: Array.from(new Set(data.map(i => i.mainCategory).filter(Boolean))).sort()
  }), [data]);

  const filterOptions = [
    { value: 'all', label: '🌐 All Languages', count: stats.total },
    { value: 'english', label: '🇺🇸 English', count: stats.english },
    { value: 'spanish', label: '🇪🇸 Spanish', count: stats.spanish }
  ];

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-purple-500/30">
      
      {loading && (
        <LoadingOverlay 
          progress={loadProgress.current} 
          total={loadProgress.total} 
          status={loadStatus}
          onCancel={cancelSync}
          startTime={loadStartTime}
          error={syncError}
          onRetry={handleRetrySync}
        />
      )}

      <EditModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
        initialData={editingItem}
        isDeleting={handleDelete}
      />

      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="text-center mb-10 flex flex-col items-center relative">
          
          {/* Master Tools Dropdown (Top Right) */}
          {isGasEnvironment && (
            <div className="absolute right-0 top-0 hidden md:block">
              <div className="relative">
                <button
                  onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-700 transition-colors shadow-lg group"
                >
                  <Settings size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                  <span className="font-medium text-sm">Tools</span>
                </button>
                
                {showToolsDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowToolsDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden animate-slide-in-down origin-top-right ring-1 ring-white/10 flex flex-col max-h-[85vh] overflow-y-auto custom-scrollbar">
                      
                      {/* Master Suite Section */}
                      <div className="p-3 border-b border-white/5">
                        <div className="px-2 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Master Suite</div>
                        <button onClick={() => handleMasterAction('MASTER_openDashboard')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <LayoutDashboard size={16} className="text-purple-400" /> Dashboard
                        </button>
                        <button onClick={() => handleMasterAction('MASTER_showRecentLogsDialog')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <FileText size={16} className="text-blue-400" /> View Logs
                        </button>
                        <button onClick={() => handleMasterAction('MASTER_showLinkManagerDialog')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Settings size={16} className="text-slate-400" /> Link Manager
                        </button>
                      </div>

                      {/* Python AI Section */}
                      <div className="p-3 border-b border-white/5">
                        <div className="px-2 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} /> Python AI Tools
                        </div>
                        <button onClick={() => handleMasterAction('openMLCategorizer')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <ExternalLink size={16} className="text-orange-400" /> ML Categorizer
                        </button>
                        <button onClick={() => handleMasterAction('openDataQuality')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Database size={16} className="text-emerald-400" /> Data Quality Check
                        </button>
                        <button onClick={() => handleMasterAction('openDuplicateFinder')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Copy size={16} className="text-yellow-400" /> Duplicate Finder
                        </button>
                        <button onClick={() => handleMasterAction('openTextExpanderCategorizer')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Terminal size={16} className="text-pink-400" /> Text Expander AI
                        </button>
                        <button onClick={() => handleMasterAction('openToolsFolder')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <FolderOpen size={16} className="text-blue-300" /> Open Tools Folder
                        </button>
                      </div>

                      {/* Cache Management */}
                      <div className="p-3 border-b border-white/5">
                        <div className="px-2 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <HardDrive size={10} /> Cache & Performance
                        </div>
                        <button onClick={() => handleMaintenanceAction('warmShortcutsCache', 'Warm Cache')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Play size={16} className="text-green-400" /> Warm Cache
                        </button>
                        <button onClick={() => handleMaintenanceAction('rebuildShortcutsCache', 'Rebuild Cache')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <RefreshCw size={16} className="text-blue-400" /> Rebuild Cache
                        </button>
                        <button onClick={() => handleMaintenanceAction('invalidateShortcutsCache', 'Clear Cache')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Trash size={16} className="text-red-400" /> Clear Cache
                        </button>
                        <button onClick={() => handleMasterAction('showCacheStatistics')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <BarChart2 size={16} className="text-yellow-400" /> Cache Stats
                        </button>
                      </div>

                      {/* Maintenance & Cleanup */}
                      <div className="p-3 border-b border-white/5">
                        <div className="px-2 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Wrench size={10} /> Maintenance
                        </div>
                        <button onClick={() => handleMaintenanceAction('cleanupDuplicateShortcuts', 'Cleanup Shortcuts')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Copy size={16} className="text-red-300" /> Remove Duplicate Shortcuts
                        </button>
                        <button onClick={() => handleMaintenanceAction('cleanupAllDuplicates', 'Clean All')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Trash size={16} className="text-red-500" /> Clean All Duplicates
                        </button>
                        <button onClick={() => handleMaintenanceAction('findEmptyEntries', 'Find Empty')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Search size={16} className="text-slate-400" /> Find Empty Entries
                        </button>
                      </div>

                      {/* Advanced Features */}
                      <div className="p-3 border-b border-white/5">
                        <div className="px-2 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Cloud size={10} /> Advanced
                        </div>
                        <button onClick={() => handleMaintenanceAction('addEnhancedDropdowns', 'Add Dropdowns')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Check size={16} className="text-green-300" /> Add Enhanced Dropdowns
                        </button>
                        <button onClick={() => setIsImportModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Upload size={16} className="text-blue-300" /> Import Data
                        </button>
                        <button onClick={() => handleMaintenanceAction('exportAllTEMData', 'Export Data')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Download size={16} className="text-blue-300" /> Export All Data
                        </button>
                        <button onClick={() => handleMaintenanceAction('backupTEMToDrive', 'Backup Drive')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <HardDrive size={16} className="text-purple-300" /> Backup to Drive
                        </button>
                        <button onClick={() => handleMaintenanceAction('MASTER_createProjectFolder', 'Create Project Folder')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <FolderOpen size={16} className="text-cyan-400" /> Create Project Folder
                        </button>
                      </div>

                      {/* Help */}
                      <div className="p-3 bg-slate-800/50">
                        <div className="px-2 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Help</div>
                        <button onClick={() => handleMasterAction('showTEMStatistics')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <BarChart2 size={16} className="text-white" /> View Statistics
                        </button>
                        <button onClick={() => handleMasterAction('openTextExpanderHelpDialog')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <HelpCircle size={16} className="text-white" /> Documentation
                        </button>
                        <button onClick={() => handleMasterAction('showTEMAbout')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors text-left">
                          <Info size={16} className="text-white" /> About
                        </button>
                      </div>

                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="inline-flex items-center gap-3 mb-4 group cursor-default">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
              <Terminal size={32} className="text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              Text Expansion Manager
            </h1>
          </div>
          
          <div className="flex items-center gap-2 mb-6 bg-slate-800/50 px-4 py-2 rounded-full border border-white/5">
            {isGasEnvironment ? (
              <>
                <Wifi size={14} className="text-emerald-500" />
                <span className="text-sm text-purple-200/80">Connected to Google Sheet</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-yellow-500" />
                <span className="text-sm text-yellow-500/80 font-medium">Local Fallback Mode</span>
              </>
            )}
            <span className="text-slate-600 mx-2">|</span>
            <span className="text-white font-bold text-sm">{stats.total.toLocaleString()} shortcuts</span>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => { setEditingItem(null); setIsEditModalOpen(true); }}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-full font-bold shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Plus size={18} /> New Shortcut
            </button>
            <button 
              onClick={() => startGasSync()}
              disabled={loading}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-bold flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> 
              {loading ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>
        </header>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300 group-focus-within:text-white transition-colors" size={20} />
              <input
                type="text"
                placeholder="🔍 Search shortcuts (e.g., '1126', 'omw', 'January')..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all hover:bg-white/10"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Language Filter Dropdown */}
            <div className="relative min-w-[200px]">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="w-full flex items-center gap-3 px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all h-full justify-between"
              >
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-purple-300" />
                  <span className="font-medium">
                    {filterOptions.find(f => f.value === activeFilter)?.label}
                  </span>
                </div>
                <ChevronLeft size={18} className={`text-purple-300 transition-transform duration-200 -rotate-90 ${showFilterDropdown ? 'rotate-90' : ''}`} />
              </button>
              
              {showFilterDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                  <div className="absolute top-full right-0 mt-2 w-full md:w-64 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-20 animate-slide-in-down origin-top">
                    {filterOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setActiveFilter(option.value as LanguageCategory);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full px-5 py-4 flex items-center justify-between hover:bg-white/10 transition-colors ${activeFilter === option.value ? 'bg-purple-500/20 text-purple-200' : 'text-slate-300'}`}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded-full">{option.count}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Category Dropdown (New) */}
            {stats.uniqueCategories.length > 0 && (
              <div className="relative min-w-[200px]">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full flex items-center gap-3 px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all h-full justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen size={18} className="text-blue-300" />
                    <span className="font-medium truncate max-w-[120px]">
                      {activeCategory === 'all' ? 'All Categories' : activeCategory}
                    </span>
                  </div>
                  <ChevronLeft size={18} className={`text-blue-300 transition-transform duration-200 -rotate-90 ${showCategoryDropdown ? 'rotate-90' : ''}`} />
                </button>
                
                {showCategoryDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCategoryDropdown(false)} />
                    <div className="absolute top-full right-0 mt-2 w-full md:w-64 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-20 animate-slide-in-down origin-top max-h-80 overflow-y-auto custom-scrollbar">
                      <button
                        onClick={() => { setActiveCategory('all'); setShowCategoryDropdown(false); }}
                        className={`w-full px-5 py-3 flex items-center justify-between hover:bg-white/10 transition-colors ${activeCategory === 'all' ? 'bg-blue-500/20 text-blue-200' : 'text-slate-300'}`}
                      >
                        <span className="font-medium">All Categories</span>
                      </button>
                      {stats.uniqueCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => { setActiveCategory(cat as string); setShowCategoryDropdown(false); }}
                          className={`w-full px-5 py-3 flex items-center justify-between hover:bg-white/10 transition-colors ${activeCategory === cat ? 'bg-blue-500/20 text-blue-200' : 'text-slate-300'}`}
                        >
                          <span className="font-medium truncate">{cat}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* View Toggle */}
            <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1 h-[58px] items-center">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-purple-500 text-white shadow-lg' : 'text-purple-300 hover:text-white hover:bg-white/5'}`}
                title="Grid View"
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-purple-500 text-white shadow-lg' : 'text-purple-300 hover:text-white hover:bg-white/5'}`}
                title="List View"
              >
                <List size={20} />
              </button>
            </div>
          </div>

          {/* Type Filter Bar */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide custom-scrollbar">
            <span className="text-sm text-purple-200/60 font-medium whitespace-nowrap px-2">
              Types:
            </span>
            <button
                onClick={() => setActiveType('all')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                activeType === 'all' 
                    ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/20' 
                    : 'bg-white/5 border-white/10 text-purple-200 hover:bg-white/10'
                }`}
            >
                All Types
            </button>
            {Object.entries(TYPE_FILTERS).map(([key, config]) => (
                <button
                key={key}
                onClick={() => setActiveType(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                    activeType === key
                    ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-white/10 text-purple-200 hover:bg-white/10'
                }`}
                >
                {(config as { label: string }).label}
                </button>
            ))}
          </div>

          {/* Style Filter Bar */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide custom-scrollbar">
            <span className="text-sm text-purple-200/60 font-medium whitespace-nowrap px-2">
              Font Styles:
            </span>
            <button
              onClick={() => setActiveStyle('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                activeStyle === 'all' 
                  ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/20' 
                  : 'bg-white/5 border-white/10 text-purple-200 hover:bg-white/10'
              }`}
            >
              All Styles
            </button>
            {Object.entries(LETTER_STYLES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveStyle(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                  activeStyle === key
                    ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-white/10 text-purple-200 hover:bg-white/10'
                }`}
              >
                {label.split('(')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Results Info & Pagination Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
          <p className="text-purple-200/70 text-sm">
            Showing <span className="text-white font-bold">{paginatedData.length}</span> of <span className="text-white font-bold">{filteredData.length.toLocaleString()}</span> results
            {activeFilter !== 'all' && ` in ${activeFilter}`}
            {activeType !== 'all' && ` (${TYPE_FILTERS[activeType].label})`}
            {activeCategory !== 'all' && ` in ${activeCategory}`}
          </p>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="First Page"
              >
                <ChevronLeft size={16} className="mr-[-6px]" />
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="text-sm font-mono px-4 text-purple-200">
                Page <span className="text-white font-bold">{currentPage}</span> / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Last Page"
              >
                <ChevronRight size={16} className="mr-[-6px]" />
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Shortcuts Grid/List */}
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
          : "flex flex-col gap-3"
        }>
          {paginatedData.map((item, index) => (
            <div
              key={`${item.k}-${index}`}
              onClick={() => handleCopy(item.e, `${item.k}-${index}`)}
              className={`group cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1 ${copiedId === `${item.k}-${index}` ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : ''}`}
            >
              <div className={viewMode === 'grid' ? 'h-full flex flex-col' : 'flex items-center gap-6'}>
                {/* Header / Trigger */}
                <div className={`flex items-start justify-between ${viewMode === 'grid' ? 'mb-3' : 'min-w-[180px]'}`}>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-purple-300/50 font-medium uppercase tracking-wider flex items-center gap-1">
                      Trigger
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingItem(item); setIsEditModalOpen(true); }}
                        className="text-purple-300 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                        title="Edit Shortcut"
                      >
                        <Terminal size={10} />
                      </button>
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg text-sm font-mono font-bold text-purple-100 group-hover:border-purple-500/60 transition-colors">
                      {item.k}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => handleToggleFavorite(e, item)}
                            className={`p-1 rounded-full transition-colors ${item.favorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Star size={14} fill={item.favorite ? "currentColor" : "none"} />
                        </button>
                        {item.style && viewMode === 'grid' && (
                        <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-purple-200/60 border border-white/5">
                            {LETTER_STYLES[item.style]?.split(' ')[0] || 'Art'}
                        </span>
                        )}
                    </div>
                    {/* Show Main Category if available, else inference */}
                    {item.mainCategory ? (
                      <span className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 capitalize">
                        {item.mainCategory}
                      </span>
                    ) : (item.d || inferDescription(item) !== 'general') && viewMode === 'grid' && (
                      <span className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 capitalize">
                        {item.d || inferDescription(item)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expansion Content */}
                <div className={`flex-1 bg-black/20 rounded-xl p-3 border border-white/5 group-hover:border-white/10 transition-colors ${viewMode === 'grid' ? 'min-h-[80px]' : 'w-full'}`}>
                  {item.e.includes('\n') ? (
                    <pre className="font-mono text-xs text-emerald-300 whitespace-pre overflow-x-auto custom-scrollbar leading-relaxed">
                      {item.e}
                    </pre>
                  ) : (
                    <p className="text-white/90 text-lg font-medium break-all leading-snug">
                      {item.e}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between ${viewMode === 'grid' ? 'mt-4 pt-4 border-t border-white/5' : 'min-w-[120px] justify-end'}`}>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide border ${
                    item.s === 'english' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                    item.s === 'spanish' ? 'bg-orange-500/10 text-orange-300 border-orange-500/20' :
                    'bg-purple-500/10 text-purple-300 border-purple-500/20'
                  }`}>
                    {item.s === 'english' ? '🇺🇸 ENG' : item.s === 'spanish' ? '🇪🇸 ESP' : '🌐 ALL'}
                  </span>
                  
                  <div className={`flex items-center gap-2 transition-colors ${copiedId === `${item.k}-${index}` ? 'text-emerald-400' : 'text-purple-300/50 group-hover:text-purple-300'}`}>
                    {copiedId === `${item.k}-${index}` ? (
                      <>
                        <Check size={16} />
                        <span className="text-xs font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredData.length === 0 && (
          <div className="text-center py-32 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10">
            <div className="inline-block p-6 bg-slate-800 rounded-full mb-6 shadow-xl">
              <LayoutTemplate size={48} className="text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No shortcuts found</h3>
            <p className="text-purple-200/70 max-w-md mx-auto mb-8">
              We couldn't find any expansions matching your current search or filters. Try clearing them to see all results.
            </p>
            <button 
              onClick={() => {
                setSearchTerm(''); 
                setActiveFilter('all'); 
                setActiveStyle('all');
                setActiveType('all');
                setActiveCategory('all');
                setCurrentPage(1);
              }}
              className="px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-purple-50 transition-colors shadow-lg shadow-white/10"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 text-center border-t border-white/10 pt-8 pb-4">
          <p className="text-purple-200/50 text-sm flex items-center justify-center gap-2">
            <span>⚡ Built with React & Tailwind</span>
            <span>•</span>
            <span>{stats.total.toLocaleString()} Active Shortcuts</span>
            <span>•</span>
            <span>v3.8 Production</span>
          </p>
        </footer>
      </div>
    </div>
  );
}