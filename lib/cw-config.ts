import * as cdk from '@aws-cdk/core'
import * as cw from '@aws-cdk/aws-cloudwatch'
import * as logs from '@aws-cdk/aws-logs'
import { GraphqlApi } from '@aws-cdk/aws-appsync'
import { FieldConfigProps } from './utils'

export interface CWConfigProps {
  api: GraphqlApi
  fields: FieldConfigProps[]
}

export class CWConfig extends cdk.Construct {
  constructor(
    scope: cdk.Construct,
    id: string,
    { api, fields = [] }: CWConfigProps
  ) {
    super(scope, id)

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/appsync/apis/${api.apiId}`,
    })

    fields.map(({ typeName, fieldName }) => {
      const filter = new logs.MetricFilter(this, `Metric-${fieldName}`, {
        metricNamespace: `AppSync/${api.apiId}`,
        metricName: `Latency-${fieldName}`,
        metricValue: '$.duration',
        filterPattern: {
          logPatternString: `{ $.logType = "Tracing" && $.resolverArn = "*/${typeName}/resolvers/${fieldName}" }`,
        },
        logGroup,
      })

      new cw.Alarm(this, `Alarm-${typeName}-${fieldName}`, {
        alarmName: `Latency-${typeName}-${fieldName}-Alarm`,
        evaluationPeriods: 2,
        metric: filter.metric(),
        threshold: 300 * 1_000_000, // 300 ms to picoseconds
        period: cdk.Duration.minutes(2),
        actionsEnabled: true,
        comparisonOperator:
          cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      })
    })
  }
}
