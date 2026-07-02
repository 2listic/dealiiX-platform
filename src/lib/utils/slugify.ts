/**
 * Slugification for user-entered run/pipeline names, so they can be safely used
 * as remote directory name segments (e.g. `run-<slug>` / `pipeline-<slug>`).
 */

/**
 * Converts an arbitrary user-entered string into a filesystem-safe slug:
 * lowercased, non-alphanumeric runs collapsed to a single hyphen, leading/
 * trailing hyphens trimmed.
 * @param value - Raw user input (may be empty or whitespace-only).
 * @returns The slug, or '' if the input has no alphanumeric content.
 * @example
 * slugify('Poisson Convergence Study!') // 'poisson-convergence-study'
 */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Builds a run/pipeline directory name from an optional custom name, falling
 * back to a bare timestamp when no name (or only an empty/whitespace name) is given.
 * @param prefix - Directory-name prefix.
 * @param customName - Optional user-entered name.
 * @returns e.g. `run-1740000000000` or `run-poisson-convergence-study`.
 */
export const buildDirName = (
  prefix: 'run' | 'pipeline',
  customName?: string
): string => {
  const slug = customName ? slugify(customName) : ''
  return slug ? `${prefix}-${slug}` : `${prefix}-${Date.now()}`
}
