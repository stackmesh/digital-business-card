import { Field, ObjectType } from '@nestjs/graphql';
import { DateScalar } from '../graphql/date.scalar.js';
import { AchievementModel } from './achievement.model.js';

@ObjectType('Experience')
export class ExperienceModel {
  @Field()
  company!: string;

  @Field()
  position!: string;

  @Field(() => DateScalar)
  startDate!: Date;

  @Field(() => DateScalar, { nullable: true })
  endDate!: Date | null;

  @Field()
  description!: string;

  @Field(() => [AchievementModel])
  achievements!: AchievementModel[];
}
