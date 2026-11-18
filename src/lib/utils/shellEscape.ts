/**
 * Single-quotes a value for a POSIX shell so it is passed as one literal word.
 * @param value - Text to quote.
 * @returns The quoted text, with embedded single quotes escaped.
 */
export const shellEscape = (value: string): string => {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

/**
 * Wraps a shell command so its stdout and stderr are printed only when it
 * fails, keeping its exit code. The output is held in a shell variable, so no
 * temporary file is shared between concurrent runs.
 * @param command - Shell command text, already quoted where needed.
 * @returns Shell script text running the command.
 */
export const printOutputOnlyOnFailure = (command: string): string =>
  `out=$({ ${command}; } 2>&1) || { status=$?; printf '%s\\n' "$out"; exit "$status"; }`
