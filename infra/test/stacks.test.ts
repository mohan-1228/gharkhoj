import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { AppStack } from "../lib/app-stack";
import { CiStack } from "../lib/ci-stack";
import { DataStack } from "../lib/data-stack";
import { NetworkStack } from "../lib/network-stack";
import { WafStack } from "../lib/waf-stack";

/**
 * Infrastructure guard-rails as tests: if someone makes the bucket public,
 * exposes the DB, or drops WAF, CI fails before anything is deployed.
 */
let app: Template, data: Template, ci: Template, waf: Template;

beforeAll(() => {
  const cdkApp = new App({
    context: {
      // Pre-resolved lookups so tests never call AWS.
      "availability-zones:account=111111111111:region=ap-south-1": ["ap-south-1a", "ap-south-1b"],
      "cc-api-provider:account=111111111111:expectedMatchCount=exactly-one:propertiesToReturn.0=PrefixListId:propertyMatch.PrefixListName=com.amazonaws.global.cloudfront.origin-facing:region=ap-south-1:typeName=AWS$:$:EC2$:$:PrefixList":
        [{ PrefixListId: "pl-test", Identifier: "pl-test" }],
      "aws:cdk:bundling-stacks": [], // skip Lambda bundling in tests
    },
  });
  const env = { account: "111111111111", region: "ap-south-1" };
  const ciStack = new CiStack(cdkApp, "ci", { env, appName: "gk", githubRepo: "org/repo" });
  const wafStack = new WafStack(cdkApp, "waf", {
    env: { ...env, region: "us-east-1" },
    crossRegionReferences: true,
    appName: "gk",
  });
  const net = new NetworkStack(cdkApp, "net", { env, natGateways: 1 });
  const dataStack = new DataStack(cdkApp, "data", { env, vpc: net.vpc, instanceClass: "t4g.micro", isProd: true });
  const appStack = new AppStack(cdkApp, "app", {
    env,
    crossRegionReferences: true,
    appName: "gk",
    isProd: true,
    vpc: net.vpc,
    db: dataStack.db,
    dbSecurityGroup: dataStack.dbSecurityGroup,
    repository: ciStack.repository,
    imageTag: "test",
    webAclArn: wafStack.webAclArn,
    alarmEmail: "ops@example.com",
    mailFrom: "GharKhoj <no-reply@example.com>",
    monthlyBudgetUsd: 50,
    desiredCount: 1,
  });
  app = Template.fromStack(appStack);
  data = Template.fromStack(dataStack);
  ci = Template.fromStack(ciStack);
  waf = Template.fromStack(wafStack);
});

describe("storage", () => {
  it("media bucket blocks all public access, encrypts and enforces TLS", () => {
    app.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.anyValue(),
    });
    app.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } }),
        ]),
      },
    });
  });
  it("CloudFront can only read processed media, never originals or private docs", () => {
    app.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Principal: { Service: "cloudfront.amazonaws.com" },
            NotResource: Match.anyValue(),
          }),
        ]),
      },
    });
  });
});

describe("database", () => {
  it("RDS is private, encrypted, backed up and protected", () => {
    data.hasResourceProperties("AWS::RDS::DBInstance", {
      Engine: "postgres",
      PubliclyAccessible: false,
      StorageEncrypted: true,
      BackupRetentionPeriod: 7,
      DeletionProtection: true,
    });
    data.hasResourceProperties("AWS::RDS::DBParameterGroup", {
      Parameters: Match.objectLike({ "rds.force_ssl": "1" }),
    });
  });
  it("only the app security group can reach Postgres", () => {
    app.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
      FromPort: 5432,
      ToPort: 5432,
      SourceSecurityGroupId: Match.anyValue(),
    });
  });
});

describe("edge", () => {
  it("CloudFront has WAF, redirects to HTTPS and serves /media from S3", () => {
    app.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        WebACLId: Match.anyValue(),
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: "redirect-to-https" }),
        CacheBehaviors: Match.arrayWith([Match.objectLike({ PathPattern: "/media/*" })]),
      }),
    });
  });
  it("ALB rejects requests that did not come through CloudFront", () => {
    app.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
      DefaultActions: [
        Match.objectLike({ Type: "fixed-response", FixedResponseConfig: Match.objectLike({ StatusCode: "403" }) }),
      ],
    });
    app.hasResourceProperties("AWS::ElasticLoadBalancingV2::ListenerRule", {
      Conditions: [
        Match.objectLike({
          Field: "http-header",
          HttpHeaderConfig: Match.objectLike({ HttpHeaderName: "X-Origin-Verify" }),
        }),
      ],
    });
  });
  it("WAF includes managed rules and rate limits", () => {
    waf.hasResourceProperties("AWS::WAFv2::WebACL", {
      Scope: "CLOUDFRONT",
      Rules: Match.arrayWith([
        Match.objectLike({ Name: "AWSManagedRulesCommonRuleSet" }),
        Match.objectLike({ Name: "RateLimitPerIp" }),
        Match.objectLike({ Name: "RateLimitApiWrites" }),
      ]),
    });
  });
});

describe("compute & identity", () => {
  it("runs the web app on ARM64 Fargate with secrets from Secrets Manager", () => {
    app.hasResourceProperties("AWS::ECS::TaskDefinition", {
      RuntimePlatform: { CpuArchitecture: "ARM64", OperatingSystemFamily: "LINUX" },
      ContainerDefinitions: [
        Match.objectLike({
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: "DB_PASSWORD" }),
            Match.objectLike({ Name: "SESSION_SECRET" }),
          ]),
        }),
      ],
    });
    app.hasResourceProperties("AWS::ECS::Service", {
      DeploymentConfiguration: Match.objectLike({ DeploymentCircuitBreaker: { Enable: true, Rollback: true } }),
    });
  });
  it("Cognito has renter/landlord/admin groups and a code-flow client", () => {
    app.resourceCountIs("AWS::Cognito::UserPoolGroup", 3);
    app.hasResourceProperties("AWS::Cognito::UserPoolClient", { AllowedOAuthFlows: ["code"], GenerateSecret: true });
  });
  it("tour reminders run on EventBridge Scheduler every 15 minutes", () => {
    app.hasResourceProperties("AWS::Scheduler::Schedule", { ScheduleExpression: "rate(15 minutes)" });
  });
  it("alarms notify by email and a budget guards cost", () => {
    app.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: "ops@example.com" });
    app.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 50, Unit: "USD" } }),
    });
    expect(Object.keys(app.findResources("AWS::CloudWatch::Alarm")).length).toBeGreaterThanOrEqual(7);
  });
});

describe("least privilege", () => {
  it("wildcard resources are limited to APIs without resource-level permissions", () => {
    // ssmmessages:* = ECS Exec (no resource-level permissions); see docs/architecture/security.md
    const allowed = new Set([
      "logs:DescribeLogGroups",
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
      "rekognition:DetectModerationLabels",
      "sns:Publish",
      "ecr:GetAuthorizationToken",
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
    ]);
    for (const t of [app, ci]) {
      for (const [, res] of Object.entries(t.findResources("AWS::IAM::Policy"))) {
        for (const st of (
          res as { Properties: { PolicyDocument: { Statement: { Resource: unknown; Action: string | string[] }[] } } }
        ).Properties.PolicyDocument.Statement) {
          if (st.Resource === "*") {
            for (const a of [st.Action].flat()) expect(allowed.has(a), `unexpected wildcard for ${a}`).toBe(true);
          }
        }
      }
    }
  });
  it("GitHub deploy role trusts only this repo's main branch / production environment", () => {
    ci.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: Match.objectLike({
              StringLike: {
                "token.actions.githubusercontent.com:sub": [
                  "repo:org/repo:ref:refs/heads/main",
                  "repo:org/repo:environment:production",
                ],
              },
            }),
          }),
        ],
      },
    });
  });
});
