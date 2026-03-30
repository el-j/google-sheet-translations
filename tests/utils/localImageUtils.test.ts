import { walkDirectory, validateImageDirectory, DEFAULT_IMAGE_EXTENSIONS } from '../../src/utils/localImageUtils';
import type { ImageDirectoryValidationOptions } from '../../src/utils/localImageUtils';

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

jest.mock('node:fs', () => ({
  promises: {
    readdir: jest.fn(),
  },
}));

const { promises: fsp } = require('node:fs');

function makeDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// DEFAULT_IMAGE_EXTENSIONS
// ---------------------------------------------------------------------------

describe('DEFAULT_IMAGE_EXTENSIONS', () => {
  it('is a non-empty array of dot-prefixed lowercase strings', () => {
    expect(DEFAULT_IMAGE_EXTENSIONS.length).toBeGreaterThan(0);
    for (const ext of DEFAULT_IMAGE_EXTENSIONS) {
      expect(ext).toMatch(/^\.[a-z]+$/);
    }
  });

  it('includes .jpg, .png, .webp, .avif, .gif, .svg', () => {
    expect(DEFAULT_IMAGE_EXTENSIONS).toContain('.jpg');
    expect(DEFAULT_IMAGE_EXTENSIONS).toContain('.png');
    expect(DEFAULT_IMAGE_EXTENSIONS).toContain('.webp');
    expect(DEFAULT_IMAGE_EXTENSIONS).toContain('.avif');
    expect(DEFAULT_IMAGE_EXTENSIONS).toContain('.gif');
    expect(DEFAULT_IMAGE_EXTENSIONS).toContain('.svg');
  });
});

// ---------------------------------------------------------------------------
// walkDirectory
// ---------------------------------------------------------------------------

describe('walkDirectory', () => {
  it('returns all files in a flat directory', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('a.jpg', false),
      makeDirent('b.png', false),
    ]);

    const result = await walkDirectory('/root');
    expect(result).toEqual(['/root/a.jpg', '/root/b.png']);
  });

  it('recurses into sub-directories', async () => {
    // Root: one sub-dir + one file
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('sub', true),
      makeDirent('root.jpg', false),
    ]);
    // Sub dir contents
    fsp.readdir.mockResolvedValueOnce([makeDirent('nested.png', false)]);

    const result = await walkDirectory('/root');
    expect(result).toContain('/root/root.jpg');
    expect(result).toContain('/root/sub/nested.png');
    expect(result).toHaveLength(2);
  });

  it('filters files by extension (case-insensitive)', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('photo.jpg', false),
      makeDirent('banner.PNG', false),
      makeDirent('script.js', false),
      makeDirent('video.mp4', false),
    ]);

    const result = await walkDirectory('/root', { extensions: ['.jpg', '.png'] });
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.endsWith('photo.jpg'))).toBe(true);
    expect(result.some((p) => p.endsWith('banner.PNG'))).toBe(true);
    expect(result.some((p) => p.endsWith('script.js'))).toBe(false);
  });

  it('returns empty array for an empty directory', async () => {
    fsp.readdir.mockResolvedValueOnce([]);
    const result = await walkDirectory('/empty');
    expect(result).toEqual([]);
  });

  it('returns empty array when no files match the extension filter', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('file.txt', false),
      makeDirent('doc.pdf', false),
    ]);
    const result = await walkDirectory('/root', { extensions: ['.jpg'] });
    expect(result).toEqual([]);
  });

  it('propagates readdir errors', async () => {
    fsp.readdir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));
    await expect(walkDirectory('/nonexistent')).rejects.toThrow('ENOENT');
  });

  it('deeply recurses multiple levels', async () => {
    // root → a/ → b/ → leaf.png
    fsp.readdir
      .mockResolvedValueOnce([makeDirent('a', true)])
      .mockResolvedValueOnce([makeDirent('b', true)])
      .mockResolvedValueOnce([makeDirent('leaf.png', false)]);

    const result = await walkDirectory('/root');
    expect(result).toEqual(['/root/a/b/leaf.png']);
  });
});

// ---------------------------------------------------------------------------
// validateImageDirectory
// ---------------------------------------------------------------------------

describe('validateImageDirectory', () => {
  function opts(overrides: Partial<ImageDirectoryValidationOptions> = {}): ImageDirectoryValidationOptions {
    return { rootDir: '/images', ...overrides };
  }

  it('is valid when root has only sub-directories', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('projects', true),
      makeDirent('workshops', true),
    ]);

    const result = await validateImageDirectory(opts());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.subfolders).toEqual(['projects', 'workshops']);
    expect(result.rootFiles).toHaveLength(0);
  });

  it('reports an error when image files exist directly in root', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('hero.jpg', false),
      makeDirent('projects', true),
    ]);

    const result = await validateImageDirectory(opts());
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/flattened/i);
    expect(result.rootFiles).toEqual(['hero.jpg']);
  });

  it('allowRootFiles: true suppresses the root-file error', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('hero.jpg', false),
      makeDirent('projects', true),
    ]);

    const result = await validateImageDirectory(opts({ allowRootFiles: true }));
    expect(result.valid).toBe(true);
    expect(result.rootFiles).toEqual(['hero.jpg']);
  });

  it('reports an error when there are no sub-directories', async () => {
    fsp.readdir.mockResolvedValueOnce([]);

    const result = await validateImageDirectory(opts());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /sub-director/i.test(e))).toBe(true);
  });

  it('does not error on no sub-dirs when allowRootFiles is true', async () => {
    fsp.readdir.mockResolvedValueOnce([makeDirent('logo.png', false)]);

    const result = await validateImageDirectory(opts({ allowRootFiles: true }));
    // allowRootFiles suppresses both root-file error and missing-subdir error
    expect(result.valid).toBe(true);
  });

  it('warns about missing expectedSubfolders', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('projects', true),
    ]);

    const result = await validateImageDirectory(opts({
      expectedSubfolders: ['projects', 'performances', 'workshops'],
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/performances|workshops/i);
  });

  it('no warning when all expectedSubfolders are present', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('projects', true),
      makeDirent('performances', true),
      makeDirent('workshops', true),
    ]);

    const result = await validateImageDirectory(opts({
      expectedSubfolders: ['projects', 'performances', 'workshops'],
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not count non-image files as root image files', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('README.md', false),
      makeDirent('.gitkeep', false),
      makeDirent('projects', true),
    ]);

    const result = await validateImageDirectory(opts());
    expect(result.valid).toBe(true);
    expect(result.rootFiles).toHaveLength(0);
  });

  it('respects custom imageExtensions', async () => {
    fsp.readdir.mockResolvedValueOnce([
      makeDirent('video.mp4', false),
      makeDirent('projects', true),
    ]);

    // mp4 is not an image by default → should be valid (video ignored)
    const defaultResult = await validateImageDirectory(opts());
    expect(defaultResult.valid).toBe(true);
    expect(defaultResult.rootFiles).toHaveLength(0);

    fsp.readdir.mockResolvedValueOnce([
      makeDirent('video.mp4', false),
      makeDirent('projects', true),
    ]);
    // Now treat mp4 as an "image" → should detect root-level file
    const customResult = await validateImageDirectory(opts({ imageExtensions: ['.mp4'] }));
    expect(customResult.valid).toBe(false);
    expect(customResult.rootFiles).toEqual(['video.mp4']);
  });

  it('returns valid:false with an error message when rootDir does not exist', async () => {
    fsp.readdir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory, scandir \'/images\''));

    const result = await validateImageDirectory(opts());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Could not read directory/i);
    expect(result.errors[0]).toMatch(/ENOENT/);
  });

  it('truncates the root-files list in the error message when many files present', async () => {
    const manyFiles = Array.from({ length: 10 }, (_, i) => makeDirent(`img${i}.jpg`, false));
    fsp.readdir.mockResolvedValueOnce([...manyFiles, makeDirent('sub', true)]);

    const result = await validateImageDirectory(opts());
    expect(result.valid).toBe(false);
    // Error message should note there are more than shown
    expect(result.errors[0]).toMatch(/\+5 more/);
    expect(result.rootFiles).toHaveLength(10);
  });
});
