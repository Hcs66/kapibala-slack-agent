import type { Skill } from "./types";

const skills: Map<string, Skill> = new Map();

export function registerSkill(skill: Skill): void {
  if (skills.has(skill.name)) {
    console.warn(`Skill "${skill.name}" is already registered, overwriting.`);
  }
  skills.set(skill.name, skill);
}

export function getSkill(name: string): Skill | undefined {
  return skills.get(name);
}

export function getAllSkills(): Skill[] {
  return Array.from(skills.values());
}

export function clearSkills(): void {
  skills.clear();
}
