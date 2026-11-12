import { Field, ObjectType } from '@nestjs/graphql';
import { ExperienceModel } from '../experience/experience.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { SkillModel } from '../skills/skill.model.js';
import { ProfessionalLinkModel } from './professional-link.model.js';

@ObjectType('Profile')
export class ProfileModel {
  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => [ProfessionalLinkModel])
  links!: ProfessionalLinkModel[];

  @Field(() => [SkillModel])
  skills!: SkillModel[];

  @Field(() => [ExperienceModel])
  experience!: ExperienceModel[];

  @Field(() => [ProjectModel])
  projects!: ProjectModel[];
}
