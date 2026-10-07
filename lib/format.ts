const NBSP = " ";

/**
 * Keeps "20 000 ₸" on one line: digit-group spaces and the space before the tenge sign
 * become non-breaking. Catalog texts stay plain; this runs at render time.
 */
export function keepNumbersTogether(text: string): string {
  return text.replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`).replace(/(\d) ₸/g, `$1${NBSP}₸`);
}
