import { Query, Resolver } from '@nestjs/graphql';
import { SkillModel } from './skill.model.js';
import { SkillsService } from './skills.service.js';

@Resolver(() => SkillModel)
export class SkillsResolver {
  constructor(private readonly skillsService: SkillsService) {}

  @Query(() => [SkillModel], {
    description: 'Skills on the business card, ordered for display.',
  })
  skills(): Promise<SkillModel[]> {
    return this.skillsService.list();
  }
}
