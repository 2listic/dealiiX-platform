/**
 * Shared metadata envelope for exported JSON artifacts (CORAL graphs, pipelines).
 * Keeps the `version`/`author`/`date_time_utc` fields in one place so every export
 * stamps them identically.
 */

/** Author string stamped on every export produced by this app. */
export const AUTHOR = 'dealiix-platform'

/** Protocol version of the exported JSON envelope. */
export const PROTOCOL_VERSION = 1

/**
 * Builds the standard export envelope fields, with the timestamp taken at call time.
 * @returns `{ version, author, date_time_utc }` to spread onto an export payload.
 */
export const buildExportMeta = (): {
  version: number
  author: string
  date_time_utc: string
} => ({
  version: PROTOCOL_VERSION,
  author: AUTHOR,
  date_time_utc: new Date().toISOString(),
})
