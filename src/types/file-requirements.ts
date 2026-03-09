export const FILE_PRESETS = {
  music: {
    label: "Music",
    extensions: [".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac"],
  },
  images: {
    label: "Images",
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"],
  },
  videos: {
    label: "Videos",
    extensions: [".mp4", ".mov", ".webm", ".avi"],
  },
  documents: {
    label: "Documents",
    extensions: [".pdf", ".doc", ".docx"],
  },
} as const;

export type FilePresetKey = keyof typeof FILE_PRESETS;

export interface FileRequirementConfig {
  label: string;
  description?: string;
  acceptedPresets: FilePresetKey[];
  acceptedExtensions: string[];
}

/** 500 MB – large enough for a typical 4-minute video */
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

/**
 * Resolves the full set of accepted extensions from a config,
 * combining preset expansions with any explicitly listed extensions.
 */
export function resolveAcceptedExtensions(config: FileRequirementConfig): string[] {
  const set = new Set<string>();

  for (const preset of config.acceptedPresets) {
    const def = FILE_PRESETS[preset];
    if (def) {
      for (const ext of def.extensions) set.add(ext);
    }
  }

  for (const ext of config.acceptedExtensions) {
    const normalized = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    set.add(normalized);
  }

  return Array.from(set).sort();
}

/**
 * Comprehensive set of recognized file extensions for validating
 * admin-entered custom extensions. Prevents typos and made-up types.
 */
export const KNOWN_EXTENSIONS = new Set([
  // Audio
  ".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac", ".wma", ".opus", ".aiff", ".alac", ".mid", ".midi",
  // Video
  ".mp4", ".mov", ".webm", ".avi", ".mkv", ".wmv", ".flv", ".m4v", ".3gp", ".mpg", ".mpeg", ".ts",
  // Image
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp", ".tiff", ".tif", ".svg",
  ".ico", ".avif", ".raw", ".cr2", ".nef", ".dng",
  // Document / Spreadsheet / Presentation
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf",
  ".odt", ".ods", ".odp", ".csv", ".tsv", ".pages", ".numbers", ".key",
  // Archive
  ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2",
  // Data / Markup
  ".json", ".xml", ".yaml", ".yml", ".html", ".md",
  // Design
  ".eps", ".ai", ".psd", ".indd",
]);

/**
 * Checks whether a dot-prefixed extension (e.g. ".mp3") is recognized.
 */
export function isKnownExtension(ext: string): boolean {
  const normalized = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return KNOWN_EXTENSIONS.has(normalized);
}

/**
 * Maps common extensions to MIME types for the upload accept attribute
 * and server-side content-type detection.
 */
export const EXTENSION_MIME_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
