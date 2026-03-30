import { promises as fsp, type Dirent } from 'node:fs';
import { join, extname } from 'node:path';

// ---------------------------------------------------------------------------
// walkDirectory
// ---------------------------------------------------------------------------

export interface WalkDirectoryOptions {
  /**
   * Only include files whose extension (case-insensitive, including the dot)
   * is in this list. Example: `['.jpg', '.png']`.
   * When omitted, all files are included.
   */
  extensions?: string[];
}

/**
 * Recursively walks a directory and returns the absolute paths of all files
 * found inside it (and any sub-directories).
 *
 * Uses `fs/promises` throughout so it integrates cleanly with async pipelines.
 *
 * @param dir - Absolute or relative path to the directory to walk.
 * @param options - Optional filter options.
 * @returns Array of absolute file paths.
 *
 * @example
 * const files = await walkDirectory('./src/assets/remote-images', {
 *   extensions: ['.jpg', '.png'],
 * });
 * console.log(files); // ['/abs/path/projects/hero.jpg', ...]
 */
export async function walkDirectory(
  dir: string,
  options?: WalkDirectoryOptions
): Promise<string[]> {
  const { extensions } = options ?? {};
  const lowerExts = extensions?.map((e) => e.toLowerCase());

  async function go(current: string): Promise<string[]> {
    const entries = await fsp.readdir(current, { withFileTypes: true, encoding: 'utf8' });
    const results: string[] = [];

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await go(full)));
      } else if (entry.isFile()) {
        if (!lowerExts || lowerExts.includes(extname(entry.name).toLowerCase())) {
          results.push(full);
        }
      }
    }

    return results;
  }

  return go(dir);
}

// ---------------------------------------------------------------------------
// validateImageDirectory
// ---------------------------------------------------------------------------

/** Default extensions treated as "image files" for validation purposes. */
export const DEFAULT_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.svg',
  '.tiff',
  '.bmp',
  '.ico',
];

export interface ImageDirectoryValidationOptions {
  /**
   * Absolute or relative path to the root image directory to inspect
   * (e.g. `'./src/assets/remote-images'`).
   */
  rootDir: string;

  /**
   * File extensions (lower-case, with leading dot) that are counted as
   * image files.
   * Defaults to `DEFAULT_IMAGE_EXTENSIONS`.
   */
  imageExtensions?: string[];

  /**
   * When `false` (default), the presence of image files directly inside
   * `rootDir` (rather than inside sub-directories) is treated as an **error**
   * — it typically means the sync inadvertently flattened the folder
   * hierarchy.
   * Set to `true` to allow root-level images without raising an error.
   */
  allowRootFiles?: boolean;

  /**
   * Sub-folder names that are expected to be present inside `rootDir`.
   * Any names from this list that are absent produce a **warning** (not an
   * error), because the folder may simply be empty in Drive.
   *
   * Example: `['projects', 'performances', 'workshops']`
   */
  expectedSubfolders?: string[];
}

export interface ImageDirectoryValidationResult {
  /**
   * `true` when no errors were found.
   * Warnings do **not** affect this flag.
   */
  valid: boolean;
  /** Fatal problems that indicate incorrect state. */
  errors: string[];
  /** Non-fatal observations that may indicate a problem. */
  warnings: string[];
  /**
   * Names of image files found directly in `rootDir` (not in sub-directories).
   * Populated even when `allowRootFiles` is `true`.
   */
  rootFiles: string[];
  /** Names of all direct sub-directories found in `rootDir`. */
  subfolders: string[];
}

/**
 * Inspects a local image directory and validates that it has the expected
 * nested structure after a `syncDriveImages` call.
 *
 * Three things are checked:
 *
 * 1. **Root-level image files** — by default these are an error because they
 *    usually indicate the sync flattened the Drive folder hierarchy.
 * 2. **Presence of sub-directories** — at least one sub-directory must exist
 *    (unless `allowRootFiles: true`).
 * 3. **Expected sub-folder names** — if `expectedSubfolders` is provided, any
 *    missing names produce a warning.
 *
 * The function never throws; all problems are reported in the returned object.
 *
 * @example
 * import { validateImageDirectory } from '@el-j/google-sheet-translations';
 *
 * const result = await validateImageDirectory({
 *   rootDir: './src/assets/remote-images',
 *   expectedSubfolders: ['projects', 'performances', 'workshops'],
 * });
 *
 * if (!result.valid) {
 *   console.error('Image directory problems:', result.errors);
 *   process.exit(1);
 * }
 * for (const warn of result.warnings) console.warn(warn);
 */
export async function validateImageDirectory(
  options: ImageDirectoryValidationOptions
): Promise<ImageDirectoryValidationResult> {
  const {
    rootDir,
    imageExtensions = DEFAULT_IMAGE_EXTENSIONS,
    allowRootFiles = false,
    expectedSubfolders = [],
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  const rootFiles: string[] = [];
  const subfolders: string[] = [];

  const lowerExts = imageExtensions.map((e) => e.toLowerCase());

  // Check that rootDir actually exists.
  let entries: Dirent<string>[];
  try {
    entries = await fsp.readdir(rootDir, { withFileTypes: true, encoding: 'utf8' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [`Could not read directory "${rootDir}": ${msg}`],
      warnings,
      rootFiles,
      subfolders,
    };
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subfolders.push(entry.name);
    } else if (entry.isFile()) {
      if (lowerExts.includes(extname(entry.name).toLowerCase())) {
        rootFiles.push(entry.name);
      }
    }
  }

  // Error: image files at root level (unless explicitly allowed).
  if (!allowRootFiles && rootFiles.length > 0) {
    errors.push(
      `Image files found directly in "${rootDir}" — the folder structure may have been flattened during sync. ` +
        `Files: ${rootFiles.slice(0, 5).join(', ')}${rootFiles.length > 5 ? ` … (+${rootFiles.length - 5} more)` : ''}`
    );
  }

  // Error: no sub-directories at all (and root-level files are not allowed).
  if (!allowRootFiles && subfolders.length === 0) {
    errors.push(
      `No sub-directories found in "${rootDir}". Expected a nested folder structure (e.g. projects/, performances/).`
    );
  }

  // Warning: expected sub-folders are missing.
  const missing = expectedSubfolders.filter((name) => !subfolders.includes(name));
  if (missing.length > 0) {
    warnings.push(
      `Some expected sub-folders are absent from "${rootDir}": ${missing.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rootFiles,
    subfolders,
  };
}
