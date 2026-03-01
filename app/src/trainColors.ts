/**
 * Shared train category color palette used across the entire app.
 * Colours are designed to be:
 *   - Distinct from each other
 *   - Softer / more modern than CFR's legacy harsh reds and full greens
 *   - Readable in both light and dark mode
 *   - Faithful to CFR's loose category semantics (IC=premium, IR=fast, R=regional)
 */

export const CATEGORY_COLORS: Record<string, string> = {
    IC: '#15803D',  // emerald green  — premium intercity service
    ICN: '#166534',  // deep green     — intercity noapte (night)
    IR: '#B91C1C',  // deep red       — interregio (fast regional)
    IRN: '#991B1B',  // darker red     — interregio noapte (night fast)
    R: '#1D4ED8',  // royal blue     — regio (standard regional)
    'R-E': '#4338CA',  // indigo         — regio express (semi-fast regional)
    RE: '#4338CA',  // alias
    A: '#6B7280',  // slate gray     — accelerat (historic)
    P: '#78716C',  // stone          — personal / slow stopping
};

/** Background tint (used for pill/badge backgrounds) */
export const CATEGORY_BG_ALPHA = '22'; // hex alpha ~13%

/**
 * Returns the hex foreground colour for a train number / category prefix.
 * e.g. "IC 534" → '#15803D'
 *      "IRN 1456" → '#991B1B'
 *      "534" (bare number, unknown) → '#4B5563'
 */
export function categoryColor(trainNumber: string | undefined): string {
    if (!trainNumber) return '#4B5563';
    const prefix = trainNumber.trim().split(/[\s\d]/)[0]?.toUpperCase() ?? '';
    return CATEGORY_COLORS[prefix] ?? '#4B5563';
}

/**
 * Returns a readable category label (just the non-numeric prefix).
 * e.g. "IC 534" → "IC"
 */
export function categoryPrefix(trainNumber: string | undefined): string {
    if (!trainNumber) return '?';
    return trainNumber.trim().split(/[\s\d]/)[0]?.toUpperCase() || '?';
}

/**
 * Formats a raw train ID into the canonical display form with a space.
 * e.g. "IC534" → "IC 534", "IC 534" → "IC 534" (already correct), "534" → "534"
 */
export function formatTrainId(trainId: string | undefined): string {
    if (!trainId) return '—';
    if (trainId.includes(' ')) return trainId;
    return trainId.replace(/^([a-zA-Z-]+)(\d+)$/, '$1 $2');
}
