import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('Project')
export class ProjectModel {
  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  url!: string;

  @Field(() => String, { nullable: true })
  repositoryUrl!: string | null;
}
