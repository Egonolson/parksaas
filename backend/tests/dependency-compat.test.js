'use strict';

const qs = require('qs');
const { v4, v5, validate } = require('uuid');

describe('dependency security and compatibility', () => {
  test('preserves nested URL-encoded form and repeated-array parsing', () => {
    expect(qs.parse('customer[name]=Fixture&spots[]=a&spots[]=b')).toEqual({
      customer: { name: 'Fixture' }, spots: ['a', 'b'],
    });
  });

  test('comma serialization cannot crash on a non-callable own toString', () => {
    expect(() => qs.stringify({ items: [{ toString: 'not-callable' }] }, { arrayFormat: 'comma' })).not.toThrow();
  });

  test('serialization does not invoke a non-callable constructor.isBuffer', () => {
    expect(() => qs.stringify({ value: { constructor: { isBuffer: 'not-callable' } } })).not.toThrow();
  });

  test('the existing CommonJS UUID-v4 API produces valid distinct identifiers', () => {
    const first = v4();
    expect(validate(first)).toBe(true);
    expect(v4()).not.toBe(first);
  });

  test('namespace UUIDs reject insufficient output buffers instead of partial writes', () => {
    expect(() => v5('fixture', v5.DNS, new Uint8Array(8), 4)).toThrow(RangeError);
  });
});
