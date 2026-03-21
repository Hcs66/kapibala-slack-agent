import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";

export interface RecruitmentAttachment {
  fileUploadId: string;
  filename: string;
}

export interface RecruitmentData {
  candidateName: string;
  positionApplied: string;
  currentStatus: string;
  resumeSource: string;
  phone: string;
  email: string;
  interviewTime: string | null;
  zoomMeetingLink: string;
  resumeLink: string;
  resumeAttachments: RecruitmentAttachment[];
}

export async function createCandidate(data: RecruitmentData) {
  const databaseId = process.env.NOTION_RECRUITMENT_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_RECRUITMENT_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    "Candidate Name": {
      title: [{ text: { content: data.candidateName } }],
    },
    "Position Applied": {
      select: { name: data.positionApplied },
    },
    "Resume Source": {
      select: { name: data.resumeSource },
    },
  };

  if (data.phone) {
    properties.Phone = {
      phone_number: data.phone,
    };
  }

  if (data.email) {
    properties.Email = {
      email: data.email,
    };
  }

  if (data.interviewTime) {
    properties["Interview Time"] = {
      date: { start: data.interviewTime },
    };
  }

  if (data.zoomMeetingLink) {
    properties["Zoom Meeting Link"] = {
      url: data.zoomMeetingLink,
    };
  }

  if (data.resumeLink) {
    properties["Resume Link"] = {
      url: data.resumeLink,
    };
  }

  if (data.resumeAttachments.length > 0) {
    properties["Resume Attachment"] = {
      files: data.resumeAttachments.map((att) => ({
        type: "file_upload" as const,
        file_upload: { id: att.fileUploadId },
        name: att.filename,
      })),
    };
  }

  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties,
  });

  return page;
}

export async function updateCandidateResume(
  pageId: string,
  attachments: RecruitmentAttachment[],
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Resume Attachment": {
        files: attachments.map((att) => ({
          type: "file_upload" as const,
          file_upload: { id: att.fileUploadId },
          name: att.filename,
        })),
      },
    },
  });
}
