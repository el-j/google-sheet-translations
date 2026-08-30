import { parseDocContent, slugifyKey } from '../../src/utils/docParser';

// ── slugifyKey ────────────────────────────────────────────────────────────────

describe('slugifyKey', () => {
  it('lowercases text', () => {
    expect(slugifyKey('Hello World')).toBe('hello_world');
  });

  it('replaces spaces with underscores', () => {
    expect(slugifyKey('nav home')).toBe('nav_home');
  });

  it('replaces punctuation with underscores', () => {
    expect(slugifyKey('Hero Section!')).toBe('hero_section');
    expect(slugifyKey('nav / Home')).toBe('nav_home');
  });

  it('collapses consecutive underscores', () => {
    expect(slugifyKey('a  b')).toBe('a_b');
    expect(slugifyKey('a!!b')).toBe('a_b');
  });

  it('trims leading and trailing underscores', () => {
    expect(slugifyKey('_test_')).toBe('test');
    expect(slugifyKey('!hello!')).toBe('hello');
  });

  it('handles already-slug strings unchanged', () => {
    expect(slugifyKey('hero_title')).toBe('hero_title');
  });

  it('returns empty string for all-punctuation input', () => {
    expect(slugifyKey('!@#')).toBe('');
  });
});

// ── parseDocContent – heading strategy ───────────────────────────────────────

describe('parseDocContent (heading strategy)', () => {
  it('parses H1 → sheet, H2 → key, text → value', () => {
    const content = `
# Hero

## title
Welcome to our app

## subtitle
Start your journey
`;
    const entries = parseDocContent(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      sheetName: 'hero',
      key: 'title',
      value: 'Welcome to our app',
    });
    expect(entries[1]).toEqual({
      sheetName: 'hero',
      key: 'subtitle',
      value: 'Start your journey',
    });
  });

  it('uses defaultSheetName when no H1 is present', () => {
    const content = `## greeting\nHello!`;
    const entries = parseDocContent(content);
    expect(entries[0].sheetName).toBe('content');
  });

  it('accepts custom defaultSheetName', () => {
    const content = `## greeting\nHello!`;
    const entries = parseDocContent(content, { defaultSheetName: 'ui' });
    expect(entries[0].sheetName).toBe('ui');
  });

  it('handles multiple H1 sections', () => {
    const content = `
# Navigation

## home
Home

# Footer

## copyright
© 2024
`;
    const entries = parseDocContent(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ sheetName: 'navigation', key: 'home' });
    expect(entries[1]).toMatchObject({ sheetName: 'footer', key: 'copyright' });
  });

  it('strips trailing whitespace from values', () => {
    const content = `## title\nHello   `;
    const entries = parseDocContent(content);
    expect(entries[0].value).toBe('Hello');
  });

  it('skips H2 entries with empty values', () => {
    const content = `## empty\n\n## real\nSome text`;
    const entries = parseDocContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('real');
  });

  it('slugifies H1 and H2 headings', () => {
    const content = `# My App\n\n## Welcome Page!\nHello`;
    const entries = parseDocContent(content);
    expect(entries[0].sheetName).toBe('my_app');
    expect(entries[0].key).toBe('welcome_page');
  });

  it('accumulates multi-line values under an H2', () => {
    const content = `## bio\nLine one\nLine two\nLine three`;
    const entries = parseDocContent(content);
    expect(entries[0].value).toBe('Line one\nLine two\nLine three');
  });

  it('returns empty array for document with no H2 headings', () => {
    const content = `# Section\n\nJust some text without an H2.`;
    const entries = parseDocContent(content);
    expect(entries).toHaveLength(0);
  });
});

// ── parseDocContent – marker strategy ────────────────────────────────────────

describe('parseDocContent (marker strategy)', () => {
  it('parses [[key:keyName]] markers without sheet prefix', () => {
    const content = `[[key:greeting]]\nHello World\n[[key:farewell]]\nGoodbye`;
    const entries = parseDocContent(content, { strategy: 'marker' });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      sheetName: 'content',
      key: 'greeting',
      value: 'Hello World',
    });
    expect(entries[1]).toEqual({
      sheetName: 'content',
      key: 'farewell',
      value: 'Goodbye',
    });
  });

  it('parses [[key:sheet.key]] markers with sheet prefix', () => {
    const content = `[[key:hero.title]]\nWelcome!\n[[key:nav.home]]\nHome`;
    const entries = parseDocContent(content, { strategy: 'marker' });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ sheetName: 'hero', key: 'title', value: 'Welcome!' });
    expect(entries[1]).toMatchObject({ sheetName: 'nav', key: 'home', value: 'Home' });
  });

  it('uses custom defaultSheetName for markers without dot prefix', () => {
    const content = `[[key:title]]\nHello`;
    const entries = parseDocContent(content, {
      strategy: 'marker',
      defaultSheetName: 'landing',
    });
    expect(entries[0].sheetName).toBe('landing');
  });

  it('skips markers with empty values', () => {
    const content = `[[key:empty]]\n\n[[key:real]]\nSome text`;
    const entries = parseDocContent(content, { strategy: 'marker' });
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('real');
  });

  it('returns empty array when no markers present', () => {
    const content = `Just plain text without any markers.`;
    const entries = parseDocContent(content, { strategy: 'marker' });
    expect(entries).toHaveLength(0);
  });

  it('slugifies marker paths', () => {
    const content = `[[key:My Sheet.My Key]]\nValue`;
    const entries = parseDocContent(content, { strategy: 'marker' });
    expect(entries[0].sheetName).toBe('my_sheet');
    expect(entries[0].key).toBe('my_key');
  });
});

// ── parseDocContent – numbered strategy ──────────────────────────────────────

describe('parseDocContent (numbered strategy)', () => {
  it('numbers paragraphs sequentially', () => {
    const content = `First paragraph\n\nSecond paragraph\n\nThird paragraph`;
    const entries = parseDocContent(content, { strategy: 'numbered' });
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      sheetName: 'content',
      key: 'item_1',
      value: 'First paragraph',
    });
    expect(entries[2]).toMatchObject({ key: 'item_3' });
  });

  it('uses custom defaultSheetName', () => {
    const content = `Para one\n\nPara two`;
    const entries = parseDocContent(content, {
      strategy: 'numbered',
      defaultSheetName: 'faq',
    });
    expect(entries[0].sheetName).toBe('faq');
  });

  it('strips leading heading markers from paragraphs', () => {
    const content = `# Title\n\nPlain paragraph`;
    const entries = parseDocContent(content, { strategy: 'numbered' });
    expect(entries[0].value).toBe('Title');
    expect(entries[1].value).toBe('Plain paragraph');
  });

  it('skips blank-only paragraphs', () => {
    const content = `\n\nFirst\n\n\n\nSecond`;
    const entries = parseDocContent(content, { strategy: 'numbered' });
    expect(entries).toHaveLength(2);
    expect(entries[0].key).toBe('item_1');
  });

  it('returns empty array for blank document', () => {
    const entries = parseDocContent('   \n  \n   ', { strategy: 'numbered' });
    expect(entries).toHaveLength(0);
  });
});

// ── parseDocContent – defaults ────────────────────────────────────────────────

describe('parseDocContent (defaults)', () => {
  it('uses heading strategy by default', () => {
    const content = `## key\nValue`;
    const entries = parseDocContent(content);
    expect(entries[0].key).toBe('key');
  });

  it('uses "content" as default sheet name', () => {
    const content = `## key\nValue`;
    const entries = parseDocContent(content);
    expect(entries[0].sheetName).toBe('content');
  });
});
