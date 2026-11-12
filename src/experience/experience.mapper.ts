import type { ExperienceModel } from './experience.model.js';

export function toExperienceModel(experience: {
  company: string;
  position: string;
  startDate: Date;
  endDate: Date | null;
  description: string;
  achievements: { description: string }[];
}): ExperienceModel {
  return {
    company: experience.company,
    position: experience.position,
    startDate: experience.startDate,
    endDate: experience.endDate,
    description: experience.description,
    achievements: experience.achievements.map((achievement) => ({
      description: achievement.description,
    })),
  };
}
