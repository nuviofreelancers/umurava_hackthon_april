import pdfParse from "pdf-parse";
import logger from "./logger";

/**
 * Extract plain text from a PDF buffer.
 * Throws if extraction fails or text is too short to be a real CV.
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text?.trim() ?? "";
    if (text.length < 50) {
      throw new Error("PDF extracted text is too short — file may be image-only or encrypted");
    }
    return text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PDF parse error:", msg);
    throw new Error(`Could not extract text from PDF: ${msg}`);
  }
}
