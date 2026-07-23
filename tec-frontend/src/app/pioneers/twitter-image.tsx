// Twitter/X share card — same branded "Founding 100" image as the OpenGraph card.
// The route config is declared directly (Next reads these statically); only the
// image generator is reused from opengraph-image.tsx.
export const runtime = 'edge';
export const alt = 'TEC Founding 100 — become a Founding Pioneer on Pi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export { default } from './opengraph-image';
