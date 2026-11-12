import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('ProfessionalLink')
export class ProfessionalLinkModel {
  @Field()
  label!: string;

  @Field()
  url!: string;
}
