type ClipKeywords = { id: string; keywords: { ja: string[]; en: string[] } };
export function suggestMotions(
  text: string,
  locale: 'ja' | 'en',
  clips: readonly ClipKeywords[],
): string[] {
  const normalized = text.normalize('NFKC').toLowerCase();
  const ranked = clips
    .map((clip) => ({
      id: clip.id,
      score: clip.keywords[locale].reduce((score, keyword) => {
        const word = keyword.normalize('NFKC').toLowerCase();
        if (!word) return score;
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matched =
          locale === 'ja'
            ? normalized.includes(word)
            : new RegExp(
                `(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`,
                'u',
              ).test(normalized);
        return score + (matched ? word.length : 0);
      }, 0),
    }))
    .filter((clip) => clip.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.length
    ? ranked.slice(0, 4).map((clip) => clip.id)
    : ['idle_breathe'];
}
