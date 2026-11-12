import type { ProjectModel } from './project.model.js';

export function toProjectModel(project: {
  name: string;
  description: string;
  url: string;
  repositoryUrl: string | null;
}): ProjectModel {
  return {
    name: project.name,
    description: project.description,
    url: project.url,
    repositoryUrl: project.repositoryUrl,
  };
}
