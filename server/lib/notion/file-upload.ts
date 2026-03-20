export interface NotionFileUploadResult {
  fileUploadId: string;
  filename: string;
}

export async function uploadFileToNotion(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<NotionFileUploadResult> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const fileUpload = await notion.fileUploads.create({
    mode: "single_part",
    filename,
    content_type: contentType,
  });

  await notion.fileUploads.send({
    file_upload_id: fileUpload.id,
    file: {
      data: new Blob([new Uint8Array(buffer)], { type: contentType }),
      filename,
    },
  });

  return {
    fileUploadId: fileUpload.id,
    filename,
  };
}
