import { tool } from "ai";
import { z } from "zod";

import type { DecisionRecord, DocRecord } from "~/lib/notion/query";

interface KnowledgeResult {
  id: string;
  title: string;
  source: "docs" | "decisions";
  snippet: string;
  url: string;
}

function docToKnowledgeResult(doc: DocRecord): KnowledgeResult {
  return {
    id: doc.id,
    title: doc.docName,
    source: "docs",
    snippet: doc.summary.slice(0, 300),
    url: doc.url,
  };
}

function decisionToKnowledgeResult(decision: DecisionRecord): KnowledgeResult {
  return {
    id: decision.id,
    title: decision.title,
    source: "decisions",
    snippet: decision.content.slice(0, 300),
    url: decision.url,
  };
}

const searchKnowledge = tool({
  description:
    "Search the team knowledge base (Notion docs and decisions) for information. Returns search results with titles, snippets, and source links. Use this when the user asks about past discussions, documentation, decisions, or organizational knowledge.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search query — extract key terms from the user's question (2-4 words work best)",
      ),
    sources: z
      .array(z.enum(["docs", "decisions"]))
      .optional()
      .describe(
        "Filter by source type. Omit to search both. Use ['docs'] for documentation/guides, ['decisions'] for organizational decisions.",
      ),
  }),
  execute: async ({ query, sources }) => {
    "use step";

    const { queryDocs, queryDecisions } = await import("~/lib/notion/query");

    try {
      const searchSources = sources ?? ["docs", "decisions"];
      const results: KnowledgeResult[] = [];

      const promises: Promise<void>[] = [];

      if (searchSources.includes("docs")) {
        promises.push(
          queryDocs({ keyword: query }).then((docs) => {
            results.push(...docs.map(docToKnowledgeResult));
          }),
        );
      }

      if (searchSources.includes("decisions")) {
        promises.push(
          queryDecisions({ keyword: query }).then((decisions) => {
            results.push(...decisions.map(decisionToKnowledgeResult));
          }),
        );
      }

      await Promise.all(promises);

      if (results.length === 0) {
        return {
          success: true,
          count: 0,
          message:
            "No results found. Try different keywords or check Notion directly.",
          results: [],
        };
      }

      return {
        success: true,
        count: results.length,
        message: `Found ${results.length} result(s) in the knowledge base.`,
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          source: r.source,
          snippet: r.snippet,
          url: r.url,
        })),
      };
    } catch (error) {
      console.error("Failed to search knowledge base:", error);
      return {
        success: false,
        message: "Failed to search the knowledge base",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const getKnowledgePageContent = tool({
  description:
    "Retrieve the full content of a specific Notion page from the knowledge base. Use this after searchKnowledge when you need more detail from a promising result. Only fetch up to 3 pages per user question to avoid overwhelming context.",
  inputSchema: z.object({
    pageId: z
      .string()
      .describe(
        "The Notion page ID from searchKnowledge results (the 'id' field)",
      ),
  }),
  execute: async ({ pageId }) => {
    "use step";

    const { getPageContent } = await import("~/lib/notion/knowledge");

    try {
      const page = await getPageContent(pageId);

      return {
        success: true,
        title: page.title,
        content: page.content,
        url: page.url,
      };
    } catch (error) {
      console.error("Failed to retrieve page content:", error);
      return {
        success: false,
        message: "Failed to retrieve page content",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const knowledgeTools = {
  searchKnowledge,
  getKnowledgePageContent,
};
