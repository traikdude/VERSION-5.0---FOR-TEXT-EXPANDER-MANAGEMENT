export type LanguageCategory = 'all' | 'spanish' | 'english';

export interface ShortcutData {
  k: string; // Key / Trigger
  e: string; // Expansion
  s: LanguageCategory; // Section/Category
  style?: string; // Font style category
}
