/**
 * Single-quotes a value for a POSIX shell so it is passed as one literal word.
 * @param value - Text to quote.
 * @returns The quoted text, with embedded single quotes escaped.
 */
export const shellEscape = (value: string): string => {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}
