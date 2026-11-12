import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('Skill')
export class SkillModel {
  @Field()
  name!: string;

  @Field()
  category!: string;
}
