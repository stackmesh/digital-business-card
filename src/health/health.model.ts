import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Liveness of the API process.' })
export class HealthReportModel {
  @Field(() => String)
  status!: string;
}
