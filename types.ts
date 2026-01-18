export type LanguageCategory = 'all' | 'spanish' | 'english';

export interface ShortcutData {
  id?: string;
  k: string; // Key / Trigger
  e: string; // Expansion
  s: LanguageCategory; // Section/Category
  style?: string; // Font style category
  d?: string; // Description / Type
  favorite?: boolean;
  tags?: string;
  application?: string;
  // New fields from backend
  mainCategory?: string;
  subcategory?: string;
  platform?: string;
  usageFrequency?: string;
  updatedAt?: string;
}

// Google Apps Script Global Interface
export interface GoogleScriptRun {
  withSuccessHandler: (handler: (data: any) => void) => GoogleScriptRun;
  withFailureHandler: (handler: (error: Error) => void) => GoogleScriptRun;
  
  // --- Core App Handlers ---
  getAppBootstrapData: () => void;
  beginShortcutsSnapshotHandler: () => void;
  fetchShortcutsBatch: (token: string, offset: number, limit: number) => void;
  upsertShortcut: (payload: any) => void;
  deleteShortcut: (key: string) => void;
  toggleFavorite: (snippetName: string) => void; // Assuming exists in favorites.gs
  handleClipboardFavorite: (key: string) => void;
  bulkImport: (payload: { mode: string, text: string, defaultApplication?: string, defaultLanguage?: string }) => void;
  
  // --- Master Automation Framework ---
  MASTER_openDashboard: () => void;
  MASTER_openColab: () => void;
  MASTER_openGitHub: () => void;
  MASTER_showRecentLogsDialog: () => void;
  MASTER_showLinkManagerDialog: () => void;
  MASTER_createProjectFolder: () => void;
  MASTER_openProjectFolder: () => void;

  // --- Python AI Tools ---
  openMLCategorizer: () => void;
  openDataQuality: () => void;
  openDuplicateFinder: () => void;
  openAnalytics: () => void;
  openBackupSystem: () => void;
  openDriveBridge: () => void;
  openFontCategorizer: () => void;
  openTextExpanderCategorizer: () => void;
  openToolsFolder: () => void;
  configurePythonURLs: () => void;

  // --- Maintenance & Cache ---
  cleanupDuplicateShortcuts: () => void;
  cleanupDuplicateFavorites: () => void;
  cleanupAllDuplicates: () => void;
  findEmptyEntries: () => void;
  removeEmptyEntries: () => void;
  generateCleanupReport: () => void;
  
  warmShortcutsCache: () => void;
  rebuildShortcutsCache: () => void;
  invalidateShortcutsCache: () => void;
  showCacheStatistics: () => void;
  testCachePerformance: () => void;

  // --- Advanced Features ---
  addEnhancedDropdowns: () => void;
  removeEnhancedDropdowns: () => void;
  refreshEnhancedDropdowns: () => void;
  exportAllTEMData: () => void;
  importTEMData: () => void; // Keeping for legacy if needed, but UI will use bulkImport
  backupTEMToDrive: () => void;
  restoreFromBackup: () => void;

  // --- Info & Stats ---
  showTEMStatistics: () => void;
  openTextExpanderHelpDialog: () => void;
  showTEMAbout: () => void;
}

declare global {
  interface Window {
    google?: {
      script: {
        run: GoogleScriptRun;
        host: {
          close: () => void;
        };
      };
    };
  }
}
