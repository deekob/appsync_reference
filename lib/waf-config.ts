import * as cdk from '@aws-cdk/core'
import * as waf2 from '@aws-cdk/aws-wafv2'
import { GraphqlApi } from '@aws-cdk/aws-appsync'

export interface WafConfigProps {
  api: GraphqlApi
}

export class WafConfig extends cdk.Construct {
  public readonly acl: waf2.CfnWebACL
  public readonly association: waf2.CfnWebACLAssociation

  constructor(scope: cdk.Construct, id: string, { api }: WafConfigProps) {
    super(scope, id)

    const allowedIPs = new cdk.CfnParameter(this, 'allowedIPs', {
      type: 'CommaDelimitedList',
      description: 'Your allowed IPs',
    })

    const allowedIPSet = new waf2.CfnIPSet(this, 'MyIP', {
      addresses: allowedIPs.valueAsList,
      ipAddressVersion: 'IPV4',
      scope: 'REGIONAL',
      name: 'MyIP',
    })

    this.acl = new waf2.CfnWebACL(this, `ACL`, {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      name: `waf-appsync-${api.apiId}`,
      description: `ACF for AppSync API - ${api.apiId}`,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: `waf-appsync-${api.apiId}`,
      },
      rules: [
        {
          name: 'FloodProtection',
          action: { block: {} },
          priority: 1,
          statement: {
            rateBasedStatement: { aggregateKeyType: 'IP', limit: 2000 },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
            metricName: `FloodProtection`,
          },
        },
        {
          name: 'RestrictAPIKey',
          action: { block: {} },
          priority: 2,
          statement: {
            andStatement: {
              statements: [
                {
                  byteMatchStatement: {
                    fieldToMatch: { singleHeader: { name: 'x-api-key' } },
                    positionalConstraint: 'EXACTLY',
                    searchString: api.apiKey,
                    textTransformations: [{ priority: 1, type: 'LOWERCASE' }],
                  },
                },
                {
                  notStatement: {
                    statement: {
                      ipSetReferenceStatement: { arn: allowedIPSet.attrArn },
                    },
                  },
                },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
            metricName: `RestrictAPIKey`,
          },
        },
      ],
    })

    this.association = new waf2.CfnWebACLAssociation(this, 'APIAssoc', {
      resourceArn: api.arn,
      webAclArn: this.acl.attrArn,
    })
  }
}
