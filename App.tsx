import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Copy, Check, Terminal, X, LayoutTemplate, LayoutGrid, List, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { EXPANSIONS_DATA, LETTER_STYLES } from './data';
import { LanguageCategory } from './types';

// Toast Notification Component
const Toast = ({ message, type, onClose }: { message: string, type: string, onClose: () => void }) => {
  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  React.useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`${bgColor} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in backdrop-blur-sm z-50`}>
      {type === 'success' ? <Check size={20} /> : <Terminal size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

// Main App Component
export default function TextExpansionManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<LanguageCategory>('all');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: string }>>([]);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Filter and search logic
  const filteredData = useMemo(() => {
    return EXPANSIONS_DATA.filter(item => {
      const matchesSearch = searchTerm === '' || 
        item.k.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.e.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = activeFilter === 'all' || item.s === activeFilter;
      
      const matchesStyle = activeStyle === 'all' ? true : item.style === activeStyle;
      
      return matchesSearch && matchesFilter && matchesStyle;
    });
  }, [searchTerm, activeFilter, activeStyle]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter, activeStyle]);

  // Statistics
  const stats = useMemo(() => ({
    total: EXPANSIONS_DATA.length,
    all: EXPANSIONS_DATA.filter(i => i.s === 'all').length,
    english: EXPANSIONS_DATA.filter(i => i.s === 'english').length,
    spanish: EXPANSIONS_DATA.filter(i => i.s === 'spanish').length,
    styles: Object.keys(LETTER_STYLES).length
  }), []);

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setToasts(prev => [...prev, { id: Date.now(), message: '✨ Copied to clipboard!', type: 'success' }]);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Fallback for iframe contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedId(id);
        setToasts(prev => [...prev, { id: Date.now(), message: '✨ Copied to clipboard!', type: 'success' }]);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (e) {
        setToasts(prev => [...prev, { id: Date.now(), message: '❌ Failed to copy', type: 'error' }]);
      }
      document.body.removeChild(textArea);
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const filterOptions = [
    { value: 'all', label: '🌐 All Languages', count: stats.total },
    { value: 'english', label: '🇺🇸 English', count: stats.english },
    { value: 'spanish', label: '🇪🇸 Spanish', count: stats.spanish }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-purple-500/30">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4 group cursor-default">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
              <Terminal size={32} className="text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              Text Expansion Manager
            </h1>
          </div>
          <p className="text-lg text-purple-200/80 max-w-2xl mx-auto">
            ⚡ Your ultimate Gboard shortcut collection with <span className="text-white font-bold">{stats.total.toLocaleString()}</span> expansions 🚀
          </p>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Shortcuts', value: stats.total, icon: '⌨️', color: 'from-purple-500/20 to-pink-500/20' },
            { label: 'Styles Available', value: stats.styles, icon: '🎨', color: 'from-blue-500/20 to-cyan-500/20' },
            { label: 'English Items', value: stats.english, icon: '🇺🇸', color: 'from-green-500/20 to-emerald-500/20' },
            { label: 'Spanish Items', value: stats.spanish, icon: '🇪🇸', color: 'from-orange-500/20 to-red-500/20' }
          ].map((stat, i) => (
            <div key={i} className={`bg-gradient-to-br ${stat.color} backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all hover:scale-105 hover:shadow-xl`}>
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
              <div className="text-sm text-purple-200/70">{stat.label}</div>
            </div>
          ))}
        </div>

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
                    <span className="text-xs text-purple-300/50 font-medium uppercase tracking-wider">Trigger</span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg text-sm font-mono font-bold text-purple-100 group-hover:border-purple-500/60 transition-colors">
                      {item.k}
                    </span>
                  </div>
                  {item.style && viewMode === 'grid' && (
                    <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-purple-200/60 border border-white/5">
                      {LETTER_STYLES[item.style]?.split(' ')[0] || 'Art'}
                    </span>
                  )}
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
            <span>v3.6</span>
          </p>
        </footer>
      </div>
    </div>
  );
}