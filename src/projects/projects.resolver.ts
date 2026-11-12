import { Query, Resolver } from '@nestjs/graphql';
import { ProjectModel } from './project.model.js';
import { ProjectsService } from './projects.service.js';

@Resolver(() => ProjectModel)
export class ProjectsResolver {
  constructor(private readonly projectsService: ProjectsService) {}

  @Query(() => [ProjectModel], {
    description: 'Projects on the business card, ordered for display.',
  })
  projects(): Promise<ProjectModel[]> {
    return this.projectsService.list();
  }
}
