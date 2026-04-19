export async function resolveNotionUserId(
  token: string,
  slackUserId: string,
): Promise<string | null> {
  try {
    const { WebClient } = await import("@slack/web-api");
    const { findNotionUser } = await import("~/lib/notion/user-map");
    const client = new WebClient(token);
    const userInfo = await client.users.info({ user: slackUserId });
    const email = userInfo.user?.profile?.email;
    if (email) {
      return await findNotionUser(email);
    }
  } catch (error) {
    console.warn("Failed to resolve Notion user:", error);
  }
  return null;
}

export async function resolveSlackUserByMention(
  token: string,
  mentionText: string,
): Promise<{ notionUserId: string | null; slackUserId: string | null }> {
  try {
    const { WebClient } = await import("@slack/web-api");
    const { findNotionUser } = await import("~/lib/notion/user-map");
    const client = new WebClient(token);

    if (mentionText.includes("@") && mentionText.includes(".")) {
      const notionUserId = await findNotionUser(mentionText);
      try {
        const lookup = await client.users.lookupByEmail({
          email: mentionText,
        });
        return {
          notionUserId,
          slackUserId: lookup.user?.id ?? null,
        };
      } catch {
        return { notionUserId, slackUserId: null };
      }
    }

    const slackIdMatch = mentionText.match(/<@(U[A-Za-z0-9]+)>/);
    const rawIdMatch = !slackIdMatch
      ? mentionText.match(/^(U[A-Za-z0-9]+)$/)
      : null;
    const extractedUserId = slackIdMatch?.[1] ?? rawIdMatch?.[1];

    if (extractedUserId) {
      const profileResult = await client.users.profile.get({
        user: extractedUserId,
      });
      const email = profileResult.profile?.email;
      if (email) {
        const notionUserId = await findNotionUser(email);
        return { notionUserId, slackUserId: extractedUserId };
      }
      return { notionUserId: null, slackUserId: extractedUserId };
    }

    const usersResult = await client.users.list({});
    const members = usersResult.members ?? [];
    const normalizedMention = mentionText.toLowerCase().trim();

    const matched = members.find((m) => {
      const name = (m.name ?? "").toLowerCase();
      const realName = (m.real_name ?? "").toLowerCase();
      const displayName = (m.profile?.display_name ?? "").toLowerCase();
      return (
        name.includes(normalizedMention) ||
        realName.includes(normalizedMention) ||
        displayName.includes(normalizedMention)
      );
    });

    if (matched?.id) {
      const profileResult = await client.users.profile.get({
        user: matched.id,
      });
      const email = profileResult.profile?.email;
      const notionUserId = email ? await findNotionUser(email) : null;
      return { notionUserId, slackUserId: matched.id };
    }

    return { notionUserId: null, slackUserId: null };
  } catch (error) {
    console.warn("Failed to resolve user by mention:", error);
    return { notionUserId: null, slackUserId: null };
  }
}

export async function resolveSlackUserByNotionId(
  token: string,
  notionUserId: string,
): Promise<string | null> {
  try {
    const { getAllNotionPersonUsers } = await import("~/lib/notion/user-map");
    const notionUsers = await getAllNotionPersonUsers();
    const match = notionUsers.find((u) => u.notionUserId === notionUserId);
    if (!match) return null;

    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient(token);
    const lookup = await client.users.lookupByEmail({ email: match.email });
    return lookup.user?.id ?? null;
  } catch (error) {
    console.warn("Failed to resolve Slack user by Notion ID:", error);
    return null;
  }
}
