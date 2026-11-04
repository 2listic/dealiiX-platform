import { describe, expect, it } from 'vitest'
import { canonicalTypeKey } from './canonicalTypeKey'
import { isTypeCompatible } from '../types/nodeTypes'

describe('Coral canonical_type_key parity', () => {
  // From coral/core/tests/output_types.cc, CanonicalizesCompilerSpecificFunctionKeys.
  const canonical =
    'std::function<void(dealii::ParameterAcceptor&,std::string&)>'
  it.each([
    'std::function<void (dealii::ParameterAcceptor &, const std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > &)>',
    'std::function<void(dealii::ParameterAcceptor&, std::string const &)>',
    'std::function<void(dealii::ParameterAcceptor&, std::__cxx11::basic_string<char> const &)>',
    'std::__1::function<void(dealii::ParameterAcceptor&,const std::__1::basic_string<char,std::__1::char_traits<char>,std::__1::allocator<char>>&)>',
    canonical,
  ])('matches %s', (spelling) => {
    expect(canonicalTypeKey(spelling)).toBe(canonical)
    expect(isTypeCompatible(spelling, canonical)).toBe(true)
  })

  it('preserves identifier substrings and matches Coral monostate removal', () => {
    expect(canonicalTypeKey('std::const_iterator')).toBe('std::const_iterator')
    expect(canonicalTypeKey('std::variant<int,std::monostate>')).toBe(
      'std::variant<int>'
    )
    expect(canonicalTypeKey('basic_string<char')).toBe('basic_string<char')
    expect(isTypeCompatible('Derived<2>', 'Derived<3>')).toBe(false)
  })
})
