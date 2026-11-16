import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";

/**
 * Web ACL for the CloudFront distribution. CloudFront-scoped WAF must live in
 * us-east-1, hence a separate stack (cross-region reference to the app stack).
 *
 * Rules (CLAUDE.md §9b): AWS managed common rules + known bad inputs + IP
 * reputation, a global per-IP rate limit, and a tighter limit on /api/ writes.
 */
export class WafStack extends Stack {
  readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: StackProps & { appName: string }) {
    super(scope, id, props);

    const managed = (name: string, priority: number, excluded: string[] = []): wafv2.CfnWebACL.RuleProperty => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: "AWS",
          name,
          ...(excluded.length ? { excludedRules: excluded.map((n) => ({ name: n })) } : {}),
        },
      },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: name, sampledRequestsEnabled: true },
    });

    const acl = new wafv2.CfnWebACL(this, "WebAcl", {
      name: `${props.appName}-web-acl`,
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.appName}-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        managed("AWSManagedRulesAmazonIpReputationList", 0),
        // SizeRestrictions_BODY is excluded because listing descriptions are legitimately long JSON bodies.
        managed("AWSManagedRulesCommonRuleSet", 1, ["SizeRestrictions_BODY"]),
        managed("AWSManagedRulesKnownBadInputsRuleSet", 2),
        {
          name: "RateLimitPerIp",
          priority: 10,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: "IP" } }, // per 5 minutes
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitPerIp",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "RateLimitApiWrites",
          priority: 11,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 300,
              aggregateKeyType: "IP",
              scopeDownStatement: {
                andStatement: {
                  statements: [
                    {
                      byteMatchStatement: {
                        fieldToMatch: { uriPath: {} },
                        positionalConstraint: "STARTS_WITH",
                        searchString: "/api/",
                        textTransformations: [{ priority: 0, type: "NONE" }],
                      },
                    },
                    {
                      notStatement: {
                        statement: {
                          byteMatchStatement: {
                            fieldToMatch: { method: {} },
                            positionalConstraint: "EXACTLY",
                            searchString: "GET",
                            textTransformations: [{ priority: 0, type: "NONE" }],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitApiWrites",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    this.webAclArn = acl.attrArn;
    new CfnOutput(this, "WebAclArn", { value: acl.attrArn });
  }
}
