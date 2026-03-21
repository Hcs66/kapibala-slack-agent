import type { UserObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type PersonUser = UserObjectResponse & { type: "person" };

let cache: PersonUser[] | null = null;

async function loadUsers(): Promise<PersonUser[]> {
  if (cache) return cache;
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const res = await notion.users.list({});
  cache = res.results.filter(
    (u): u is PersonUser => "type" in u && u.type === "person",
  );

  return cache;
}

export async function findNotionUser(email: string): Promise<string | null> {
  const users = await loadUsers();
  const user = users.find((u) => u.person?.email === email);
  return user ? user.id : null;
}
