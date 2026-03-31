import type {
  CreatePageParameters,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";

export interface TaskData {
  name: string;
  taskNum: string;
  description: string;
  summary: string;
  priority: string;
  assigneeNotionUserId: string | null;
  dueDate: string | null;
}

export async function createTask(data: TaskData) {
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_TASKS_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    Name: {
      title: [{ text: { content: data.name } }],
    },
    "Task Num": {
      rich_text: [{ text: { content: data.taskNum } }],
    },
    Description: {
      rich_text: [{ text: { content: data.description } }],
    },
    Priority: {
      select: { name: data.priority },
    },
  };

  if (data.summary) {
    properties.Summary = {
      rich_text: [{ text: { content: data.summary } }],
    };
  }

  if (data.assigneeNotionUserId) {
    properties.Assignee = {
      people: [{ id: data.assigneeNotionUserId }],
    };
  }

  if (data.dueDate) {
    properties["Due date"] = {
      date: { start: data.dueDate },
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

export async function updateTaskStatus(
  pageId: string,
  status: "To Do" | "In Progress" | "Done",
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        status: { name: status },
      },
    },
  });
}

export async function appendTaskLog(
  pageId: string,
  existingLog: string,
  newEntry: string,
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  const timestamp = new Date().toISOString().split("T")[0];
  const logEntry = `[${timestamp}] ${newEntry}`;
  const updatedLog = existingLog ? `${existingLog}\n${logEntry}` : logEntry;

  await notion.pages.update({
    page_id: pageId,
    properties: {
      Log: {
        rich_text: [{ text: { content: updatedLog } }],
      },
    },
  });

  return updatedLog;
}

export async function updateTaskProperties(
  pageId: string,
  updates: {
    status?: "To Do" | "In Progress" | "Done";
    log?: { existing: string; newEntry: string };
    priority?: string;
    assigneeNotionUserId?: string;
    dueDate?: string;
  },
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  const properties: UpdatePageParameters["properties"] = {};

  if (updates.status) {
    properties.Status = {
      status: { name: updates.status },
    };
  }

  if (updates.log) {
    const timestamp = new Date().toISOString().split("T")[0];
    const logEntry = `[${timestamp}] ${updates.log.newEntry}`;
    const updatedLog = updates.log.existing
      ? `${updates.log.existing}\n${logEntry}`
      : logEntry;
    properties.Log = {
      rich_text: [{ text: { content: updatedLog } }],
    };
  }

  if (updates.priority) {
    properties.Priority = {
      select: { name: updates.priority },
    };
  }

  if (updates.assigneeNotionUserId) {
    properties.Assignee = {
      people: [{ id: updates.assigneeNotionUserId }],
    };
  }

  if (updates.dueDate) {
    properties["Due date"] = {
      date: { start: updates.dueDate },
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}
