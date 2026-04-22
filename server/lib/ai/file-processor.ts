import type { SlackFileInfo } from "~/lib/slack/files";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PDF_PAGES = 50;

const IMAGE_MIMETYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

export interface FileExtractionResult {
  fileName: string;
  fileType: "image" | "pdf" | "unsupported";
  extractedText: string | null;
  error?: string;
}

function classifyFile(mimetype: string): "image" | "pdf" | "unsupported" {
  if (IMAGE_MIMETYPES.has(mimetype)) return "image";
  if (mimetype === "application/pdf") return "pdf";
  return "unsupported";
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text, totalPages } = await extractText(pdfBuffer, {
    mergePages: true,
  });

  const truncated = totalPages > MAX_PDF_PAGES;
  const result =
    typeof text === "string" ? text : (text as string[]).join("\n");

  if (truncated) {
    return `${result}\n\n[Note: PDF has ${totalPages} pages, only first ${MAX_PDF_PAGES} pages extracted]`;
  }
  return result;
}

async function extractTextFromImage(
  imageBuffer: Buffer,
  mediaType: string,
): Promise<string> {
  const { generateText } = await import("ai");

  const { text } = await generateText({
    model: "google/gemini-2.5-flash" as Parameters<
      typeof generateText
    >[0]["model"],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all text content from this image. Preserve the original structure and language. If it contains tables or structured data, format them clearly. Return only the extracted text, no commentary.",
          },
          {
            type: "image",
            image: imageBuffer,
            mediaType,
          },
        ],
      },
    ],
  });

  return text;
}

export async function extractFileContent(
  fileInfo: SlackFileInfo,
  token: string,
): Promise<FileExtractionResult> {
  const fileType = classifyFile(fileInfo.mimetype);

  if (fileType === "unsupported") {
    return {
      fileName: fileInfo.name,
      fileType: "unsupported",
      extractedText: null,
    };
  }

  try {
    const { downloadSlackFile } = await import("~/lib/slack/files");
    const buffer = await downloadSlackFile(fileInfo.url, token);

    if (fileType === "image" && buffer.length > MAX_IMAGE_SIZE) {
      return {
        fileName: fileInfo.name,
        fileType: "image",
        extractedText: null,
        error: "Image file too large (>20MB)",
      };
    }

    if (fileType === "pdf" && buffer.length > MAX_PDF_SIZE) {
      return {
        fileName: fileInfo.name,
        fileType: "pdf",
        extractedText: null,
        error: "PDF file too large (>50MB)",
      };
    }

    const extractedText =
      fileType === "pdf"
        ? await extractTextFromPdf(buffer)
        : await extractTextFromImage(buffer, fileInfo.mimetype);

    return {
      fileName: fileInfo.name,
      fileType,
      extractedText,
    };
  } catch (error) {
    console.error(`Failed to process file ${fileInfo.name}:`, error);
    return {
      fileName: fileInfo.name,
      fileType,
      extractedText: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function extractFilesFromMessage(
  files: Array<{ id?: string }>,
  token: string,
): Promise<FileExtractionResult[]> {
  const { getSlackFileInfo } = await import("~/lib/slack/files");
  const { WebClient } = await import("@slack/web-api");
  const client = new WebClient(token);

  const results = await Promise.all(
    files
      .filter((f): f is { id: string } => !!f.id)
      .map(async (file) => {
        const info = await getSlackFileInfo(client, file.id);
        if (!info) {
          return {
            fileName: "unknown",
            fileType: "unsupported" as const,
            extractedText: null,
            error: "Could not retrieve file info",
          };
        }
        return extractFileContent(info, token);
      }),
  );

  return results;
}
