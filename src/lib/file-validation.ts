import { fileTypeFromBuffer } from "file-type";

const IMAGE_MIME_PREFIXES = ["image/"];
const AUDIO_MIME_PREFIXES = ["audio/"];
const VIDEO_MIME_PREFIXES = ["video/"];

const MIME_CATEGORY_MAP: Record<string, string[]> = {
  image: IMAGE_MIME_PREFIXES,
  audio: AUDIO_MIME_PREFIXES,
  video: VIDEO_MIME_PREFIXES,
};

/**
 * Text-based formats that file-type cannot detect via magic bytes.
 * These must be validated by extension only.
 */
const TEXT_BASED_EXTENSIONS = new Set([
  ".svg", ".csv", ".tsv", ".txt", ".json", ".xml",
  ".yaml", ".yml", ".html", ".md", ".rtf",
]);

interface FileValidationResult {
  valid: boolean;
  detectedMime: string | null;
  error?: string;
}

/**
 * Validate that a file's actual content matches its claimed type
 * by inspecting magic bytes. Text-based formats (SVG, CSV, etc.)
 * are skipped since they have no reliable magic bytes.
 */
export async function validateFileContent(
  buffer: Buffer,
  claimedExtension: string,
  options?: {
    /** Restrict to a specific MIME category: "image", "audio", "video" */
    allowedCategory?: string;
    /** Explicit set of allowed MIME types (overrides allowedCategory) */
    allowedMimes?: Set<string>;
  }
): Promise<FileValidationResult> {
  const ext = claimedExtension.toLowerCase();

  if (TEXT_BASED_EXTENSIONS.has(ext)) {
    return { valid: true, detectedMime: null };
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      valid: false,
      detectedMime: null,
      error: "Unable to determine file type from content. The file may be corrupt or empty.",
    };
  }

  if (options?.allowedMimes) {
    if (!options.allowedMimes.has(detected.mime)) {
      return {
        valid: false,
        detectedMime: detected.mime,
        error: `File content is ${detected.mime}, which is not an allowed type.`,
      };
    }
    return { valid: true, detectedMime: detected.mime };
  }

  if (options?.allowedCategory) {
    const prefixes = MIME_CATEGORY_MAP[options.allowedCategory];
    if (prefixes) {
      const matches = prefixes.some((p) => detected.mime.startsWith(p));
      if (!matches) {
        return {
          valid: false,
          detectedMime: detected.mime,
          error: `File content is ${detected.mime}, but only ${options.allowedCategory} files are allowed.`,
        };
      }
    }
  }

  return { valid: true, detectedMime: detected.mime };
}

/**
 * Allowed extensions for organization branding assets (/api/upload).
 */
export const ALLOWED_ASSET_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
]);

export const MAX_ASSET_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
