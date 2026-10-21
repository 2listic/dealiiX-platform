/**
 * Normalizes serialized C++ type keys exactly as Coral's canonical_type_key.
 * @param type - Registry key or socket type spelling.
 * @returns Compiler-independent key, without altering the stored identifier.
 */
export const canonicalTypeKey = (type: string): string => {
  let value = type
    .replace(/(^|[^a-zA-Z0-9_])const(?=[^a-zA-Z0-9_])/g, '$1')
    .replace(/\s/g, '')
    .replace(/__cxx11::|__1::/g, '')

  for (
    let position = value.indexOf('basic_string<char');
    position !== -1;
    position = value.indexOf('basic_string<char', position)
  ) {
    let depth = 0
    let end = value.indexOf('<', position)
    for (; end < value.length; end++) {
      if (value[end] === '<') depth++
      else if (value[end] === '>' && --depth === 0) break
    }
    if (end === value.length) break
    value = value.slice(0, position) + 'string' + value.slice(end + 1)
    position += 6
  }

  return value.replace(/,std::monostate/g, '')
}
