import type { UserObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "./client";

type PersonUser = UserObjectResponse & { type: "person" };

let cache: PersonUser[] | null = null;

async function loadUsers(): Promise<PersonUser[]> {
  //if (cache) return cache;
  console.log("==================================================");
  const res = await notion.users.list({});
  console.log(res);
  console.log("==================================================");

  cache = res.results.filter(
    (u): u is PersonUser => "type" in u && u.type === "person",
  );

  return cache;
}

export async function findNotionUser(email: string): Promise<string | null> {
  console.log("==================================================");
  console.log(email);
  console.log("==================================================");
  const users = await loadUsers();
  const user = users.find((u) => u.person?.email === email);
  return user ? user.id : null;
}
