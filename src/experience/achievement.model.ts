import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('Achievement')
export class AchievementModel {
  @Field()
  description!: string;
}
