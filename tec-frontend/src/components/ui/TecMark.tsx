/**
 * The TEC monogram — the interlocked T·E·C from the brand sheet.
 *
 * Traced to a vector rather than shipped as the source PNG on purpose: the
 * render bakes in one gold, so on a light page it would be frozen on the dark
 * theme's amber while everything beside it moved. This paints in
 * `currentColor`, so the caller sets the colour and the theme carries it.
 *
 * Four separate closed shapes, not one outline with holes — the counters of
 * the E all open to the outside, so there is nothing to punch out and no
 * fill-rule to get wrong.
 *
 * The aspect ratio is fixed at the drawn 100 × 41.13. Give it a `size` (the
 * height in px) and the width follows; do not set width and height
 * independently or the letterforms shear.
 */
const RATIO = 100 / 41.13;

const D =
  'M0.09 0.84 L8.67 9.77 L25.56 9.77 L25.56 40.95 L35.09 32.01 L35.09 9.77 L64.32 9.77 L73.44 0.84 Z ' +
  'M99.78 0.84 L79.98 0.84 L67.02 13.86 L67.02 27.46 L79.98 40.95 L99.78 40.95 L91.23 32.01 L83.34 32.01 ' +
  'L75.54 24.11 L75.54 17.35 L82.65 9.77 L91.23 9.77 Z ' +
  'M41.15 16.16 L41.15 25.33 L60.74 25.33 L60.74 16.16 Z ' +
  'M41.15 32.01 L41.15 40.95 L73.44 40.95 L64.32 32.01 Z';

interface Props {
  /** Height in px. Width is derived so the mark cannot be stretched. */
  size?:  number;
  color?: string;
  /** Set when the mark is the only thing naming the app; omit when a "TEC"
   *  wordmark sits beside it, so a screen reader does not read it twice. */
  title?: string;
  className?: string;
}

export function TecMark({ size = 24, color = 'currentColor', title, className }: Props) {
  return (
    <svg
      className={className}
      width={Math.round(size * RATIO)}
      height={size}
      viewBox="0 0 100 41.13"
      fill={color}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={D} />
    </svg>
  );
}
