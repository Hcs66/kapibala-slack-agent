import type { WebClient } from "@slack/web-api";

export interface SlackFileInfo {
  id: string;
  name: string;
  mimetype: string;
  url: string;
}

export async function getSlackFileInfo(
  client: WebClient,
  fileId: string,
): Promise<SlackFileInfo | null> {
  try {
    const result = await client.files.info({ file: fileId });
    const file = result.file;
    if (!file?.id || !file.url_private_download) return null;

    return {
      id: file.id,
      name: file.name ?? "untitled",
      mimetype: file.mimetype ?? "application/octet-stream",
      url: file.url_private_download,
    };
  } catch (error) {
    console.error("Failed to get Slack file info:", fileId, error);
    return null;
  }
}

export async function downloadSlackFile(
  url: string,
  token: string,
): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Slack file: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
