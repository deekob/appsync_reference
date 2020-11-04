import * as appsync from '@aws-cdk/aws-appsync'

export interface FieldConfigProps {
  typeName: string
  fieldName: string
  cachingConfig?: appsync.CfnResolver.CachingConfigProperty
  dataSource?: appsync.BaseDataSource
  requestMappingTemplate?: appsync.MappingTemplate
  responseMappingTemplate?: appsync.MappingTemplate
}
