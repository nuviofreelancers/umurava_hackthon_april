/**
 * googleDriveClient.ts — Google Drive API v3 file fetcher
 *
 * Uses an API key (no OAuth) to fetch publicly shared Drive files.
 * Works for any file shared as "Anyone with the link can view".
 *
 * SETUP:
 *   1. Go to console.cloud.google.com → APIs & Services → Library
 *   2. Enable "Google Drive API"
 *   3. Go to Credentials → Create Credentials → API Key
 *   4. Restrict it to "Google Drive API" only
 *   5. Add to your .env: GOOGLE_DRIVE_API_KEY=your_key_here
 *
 * Supported URL formats:
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://docs.google.com/document/d/FILE_ID/edit    → exported as plain text
 *   - https://docs.google.com/presentation/d/FILE_ID/... → exported as plain text
 *
 * Returns: { buffer, mimeType, filename }
 * The buffer + mimeType can be passed directly into extractTextFromBuffer().
 */

import logger from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveFileResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

// Google Drive API v3 base URL
const DRIVE_API = "https://www.googleapis.com/drive/v3";

// These Google Workspace MIME types cannot be downloaded directly —
// they must be exported to a real format first.
const GOOGLE_WORKSPACE_EXPORT_MAP: Record<string, string> = {
  "application/vnd.google-apps.document":     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
};

// ─── URL parsing ──────────────────────────────────────────────────────────────

/**
 * Returns true if the URL is a Google Drive or Google Docs link.
 * Used by resumeParser.ts to decide whether to use this client.
 */
export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com/i.test(url);
}

/**
 * Extracts the Drive file ID from all common URL formats.
 * Returns null if no file ID can be found.
 */
export function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,           // drive.google.com/file/d/ID/...
    /[?&]id=([a-zA-Z0-9_-]+)/,               // drive.google.com/open?id=ID
    /\/document\/d\/([a-zA-Z0-9_-]+)/,       // docs.google.com/document/d/ID/...
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,   // docs.google.com/presentation/d/ID/...
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,   // docs.google.com/spreadsheets/d/ID/...
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Step 1: Fetch file metadata (name + mimeType) via Drive API v3.
 */
async function fetchFileMetadata(
  fileId: string,
  apiKey: string
): Promise<{ name: string; mimeType: string }> {
  const url = `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType&key=${apiKey}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "TalentScreenBot/1.0" },
  });

  if (res.status === 403) {
    throw new Error(
      `Google Drive API returned 403 for file ${fileId}. ` +
      `Check that the file is shared as "Anyone with the link" and your API key is valid.`
    );
  }
  if (res.status === 404) {
    throw new Error(`Google Drive file not found: ${fileId}. The link may be broken or the file deleted.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API metadata error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { name?: string; mimeType?: string };
  return {
    name:     data.name     ?? "resume",
    mimeType: data.mimeType ?? "application/octet-stream",
  };
}

/**
 * Step 2a: Export a Google Workspace file (Docs, Slides, Sheets) to a real format.
 * Returns the file content as a Buffer.
 */
async function exportWorkspaceFile(
  fileId: string,
  exportMimeType: string,
  apiKey: string
): Promise<Buffer> {
  const url = `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}&key=${apiKey}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "TalentScreenBot/1.0" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API export error ${res.status}: ${body.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Step 2b: Download a binary file (PDF, DOCX, etc.) directly.
 * Returns the file content as a Buffer.
 */
async function downloadFile(fileId: string, apiKey: string): Promise<Buffer> {
  const url = `${DRIVE_API}/files/${fileId}?alt=media&key=${apiKey}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "TalentScreenBot/1.0" },
    redirect: "follow",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API download error ${res.status}: ${body.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches a Google Drive file and returns it as a Buffer ready for
 * extractTextFromBuffer() in resumeParser.ts.
 *
 * Flow:
 *   1. Extract file ID from URL
 *   2. GET /files/{id}?fields=name,mimeType  → metadata
 *   3a. If Google Workspace type → GET /files/{id}/export  (Docs → DOCX, Slides → PPTX, Sheets → CSV)
 *   3b. Otherwise               → GET /files/{id}?alt=media (PDF, DOCX, TXT, etc.)
 *   4. Return { buffer, mimeType, filename }
 */
export async function fetchGoogleDriveFile(url: string): Promise<DriveFileResult> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_DRIVE_API_KEY is not set in environment");
  }

  const fileId = extractDriveFileId(url);
  if (!fileId) {
    throw new Error(`Could not extract a file ID from Google Drive URL: ${url}`);
  }

  logger.info(`[GoogleDrive] Fetching file ${fileId} via API`);

  // Step 1: get metadata
  const { name, mimeType } = await fetchFileMetadata(fileId, apiKey);
  logger.info(`[GoogleDrive] File: "${name}" | Type: ${mimeType}`);

  // Step 2: download or export
  const exportMimeType = GOOGLE_WORKSPACE_EXPORT_MAP[mimeType];

  if (exportMimeType) {
    // Google Workspace file — export to a real format
    logger.info(`[GoogleDrive] Exporting Google Workspace file as ${exportMimeType}`);
    const buffer = await exportWorkspaceFile(fileId, exportMimeType, apiKey);
    return { buffer, mimeType: exportMimeType, filename: name };
  } else {
    // Binary file (PDF, DOCX, TXT, image, etc.) — download directly
    logger.info(`[GoogleDrive] Downloading binary file`);
    const buffer = await downloadFile(fileId, apiKey);
    return { buffer, mimeType, filename: name };
  }
}
