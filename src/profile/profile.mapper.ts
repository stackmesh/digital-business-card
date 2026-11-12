import { toExperienceModel } from '../experience/experience.mapper.js';
import { toProjectModel } from '../projects/project.mapper.js';
import { toSkillModel } from '../skills/skill.mapper.js';
import type { ProfileModel } from './profile.model.js';
import { toProfessionalLinkModel } from './professional-link.mapper.js';

export function toProfileModel(profile: {
  name: string;
  description: string;
  professionalLinks: { label: string; url: string }[];
  skills: { name: string; category: string }[];
  experiences: Parameters<typeof toExperienceModel>[0][];
  projects: Parameters<typeof toProjectModel>[0][];
}): ProfileModel {
  return {
    name: profile.name,
    description: profile.description,
    links: profile.professionalLinks.map(toProfessionalLinkModel),
    skills: profile.skills.map(toSkillModel),
    experience: profile.experiences.map(toExperienceModel),
    projects: profile.projects.map(toProjectModel),
  };
}
