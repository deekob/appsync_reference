import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'
import * as db from '@aws-cdk/aws-dynamodb'
import * as lambda from '@aws-cdk/aws-lambda'
import * as cognito from '@aws-cdk/aws-cognito'
import { FieldConfigProps } from './utils'
import { CWConfig } from './cw-config'
import { WafConfig } from './waf-config'

export class AppsyncReferenceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const pool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'Main',
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      standardAttributes: { email: { required: true } },
    })
    pool.addClient('web', { preventUserExistenceErrors: true })

    const api = new appsync.GraphqlApi(this, 'API', {
      name: 'GraphQLAPI',
      schema: appsync.Schema.fromAsset('appsync/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: { name: 'default' },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: { userPool: pool },
          },
        ],
      },
      logConfig: {
        excludeVerboseContent: false,
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      xrayEnabled: true,
    })

    const cache = new appsync.CfnApiCache(this, 'cache', {
      apiCachingBehavior: 'PER_RESOLVER_CACHING',
      apiId: api.apiId,
      ttl: 60,
      type: 'LARGE',
    })

    const table = new db.Table(this, 'Table', {
      partitionKey: { name: 'id', type: db.AttributeType.STRING },
    })
    const dbSource = api.addDynamoDbDataSource('todos', table)

    const lambdaFunction = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'index.handler',
      environment: { TABLE: table.tableName },
      timeout: cdk.Duration.seconds(10),
    })
    table.grantReadData(lambdaFunction)
    const lambdaSource = api.addLambdaDataSource('lambda', lambdaFunction)

    const fields: FieldConfigProps[] = [
      { typeName: 'Query', fieldName: 'getTodo', dataSource: dbSource },
      { typeName: 'Mutation', fieldName: 'createTodo', dataSource: dbSource },
      { typeName: 'Query', fieldName: 'listTodos', dataSource: lambdaSource },
    ]

    fields.map((field) => createResolver(this, { api, field }))

    new CWConfig(this, 'CWConfig', { api, fields })
    const wafConfig = new WafConfig(this, 'WAFConfig', { api })

    // Outptus:
    new cdk.CfnOutput(this, 'Stack Region', { value: this.region })
    new cdk.CfnOutput(this, 'GraphQL API ID', { value: api.apiId })
    new cdk.CfnOutput(this, 'GraphQL API URL', { value: api.graphqlUrl })
    new cdk.CfnOutput(this, 'GraphQL API Key', { value: api.apiKey || 'n/a' })
    new cdk.CfnOutput(this, 'table', { value: table.tableName })
    new cdk.CfnOutput(this, 'function', { value: lambdaFunction.functionName })
    new cdk.CfnOutput(this, 'acl ref', { value: wafConfig.acl.ref })
    new cdk.CfnOutput(this, 'acl association', {
      value: wafConfig.association.ref,
    })
  }
}

interface CreateResolverProps {
  api: appsync.GraphqlApi
  field: FieldConfigProps
}

const createResolver = (
  construct: cdk.Construct,
  props: CreateResolverProps
) => {
  const {
    api,
    field: {
      typeName,
      fieldName,
      cachingConfig,
      dataSource,
      requestMappingTemplate: req,
      responseMappingTemplate: res,
    },
  } = props

  const requestMappingTemplate = req
    ? req.renderTemplate()
    : dataSource instanceof appsync.LambdaDataSource
    ? undefined
    : appsync.MappingTemplate.fromFile(
        `appsync/resolvers/${typeName}.${fieldName}.req.vtl`
      ).renderTemplate()

  const responseMappingTemplate = res
    ? res.renderTemplate()
    : dataSource instanceof appsync.LambdaDataSource
    ? undefined
    : appsync.MappingTemplate.fromFile(
        `appsync/resolvers/${typeName}.${fieldName}.res.vtl`
      ).renderTemplate()

  const dataSourceName = dataSource ? dataSource.name : undefined

  const resolver = new appsync.CfnResolver(
    construct,
    `${typeName}${fieldName}Resolver`,
    {
      apiId: api.apiId,
      typeName,
      fieldName,
      cachingConfig,
      dataSourceName,
      requestMappingTemplate,
      responseMappingTemplate,
    }
  )
  api.addSchemaDependency(resolver)
  if (dataSource) {
    resolver.addDependsOn(dataSource.ds)
  }
}
