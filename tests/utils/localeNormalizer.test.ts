import { getNormalizedLocaleForHeader } from '../../src/utils/localeNormalizer';

describe('getNormalizedLocaleForHeader', () => {
	test('should return the mapped value for a matching key', () => {
		const originalMapping = { en: 'en-GB' };
		expect(getNormalizedLocaleForHeader('en', originalMapping)).toBe('en-GB');
	});

	test('should be case-insensitive and match EN to the en key', () => {
		const originalMapping = { en: 'en-GB' };
		expect(getNormalizedLocaleForHeader('EN', originalMapping)).toBe('en-GB');
	});

	test('should return undefined when the key is not in the mapping', () => {
		const originalMapping = {};
		expect(getNormalizedLocaleForHeader('xx', originalMapping)).toBeUndefined();
	});
});
