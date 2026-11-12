import type { SkillModel } from './skill.model.js';

export function toSkillModel(skill: {
  name: string;
  category: string;
}): SkillModel {
  return {
    name: skill.name,
    category: skill.category,
  };
}
