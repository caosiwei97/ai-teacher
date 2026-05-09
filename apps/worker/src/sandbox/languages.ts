export const LANGUAGE_MAP = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  c: 50,
  typescript: 74,
  go: 60,
  rust: 73,
  ruby: 72,
  php: 68,
} as const;

export type LanguageName = keyof typeof LANGUAGE_MAP;

export function getLanguageId(name: string): number | undefined {
  return LANGUAGE_MAP[name as LanguageName];
}

export function getLanguageName(id: number): string {
  for (const [name, langId] of Object.entries(LANGUAGE_MAP)) {
    if (langId === id) return name;
  }
  return "unknown";
}
