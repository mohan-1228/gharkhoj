#!/usr/bin/env node
/**
 * GharKhoj CDK app. Stacks:
 *   gharkhoj-ci       ECR + GitHub OIDC deploy role
 *   gharkhoj-waf      CloudFront WAF (us-east-1)
 *   gharkhoj-network  VPC
 *   gharkhoj-data     RDS PostgreSQL + PostGIS
 *   gharkhoj-app      CloudFront, ALB, ECS Fargate, S3, Cognito, SES, Lambdas, alarms, budget
 *
 * Context (cdk.json or -c key=value): envName, region, alarmEmail, mailFrom,
 * bootstrapAdminEmails, imageTag, natGateways, dbInstanceClass, desiredCount, monthlyBudgetUsd.
 */
import { App, Tags } from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack";
import { CiStack } from "../lib/ci-stack";
import { DataStack } from "../lib/data-stack";
import { NetworkStack } from "../lib/network-stack";
import { WafStack } from "../lib/waf-stack";

const app = new App();
const ctx = (k: string) => app.node.tryGetContext(k) as string | undefined;

const appName = ctx("appName") ?? "gharkhoj";
const envName = ctx("envName") ?? "prod";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = ctx("region") ?? process.env.CDK_DEFAULT_REGION ?? "ap-south-1";
const env = { account, region };
const isProd = envName === "prod";

Tags.of(app).add("app", appName);
Tags.of(app).add("env", envName);
Tags.of(app).add("managed-by", "cdk");

const ci = new CiStack(app, `${appName}-ci`, {
  env,
  appName,
  githubRepo: ctx("githubRepo") ?? "mohan-1228/gharkhoj",
  existingOidcProviderArn: ctx("githubOidcProviderArn"),
});
const waf = new WafStack(app, `${appName}-waf`, {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
  appName,
});
const network = new NetworkStack(app, `${appName}-network`, { env, natGateways: Number(ctx("natGateways") ?? 1) });
const data = new DataStack(app, `${appName}-data`, {
  env,
  vpc: network.vpc,
  instanceClass: ctx("dbInstanceClass") ?? "t4g.micro",
  isProd,
});
new AppStack(app, `${appName}-app`, {
  env,
  crossRegionReferences: true,
  appName,
  isProd,
  vpc: network.vpc,
  db: data.db,
  dbSecurityGroup: data.dbSecurityGroup,
  repository: ci.repository,
  imageTag: ctx("imageTag"),
  webAclArn: waf.webAclArn,
  alarmEmail: ctx("alarmEmail") || undefined,
  mailFrom: ctx("mailFrom") || undefined,
  bootstrapAdminEmails: ctx("bootstrapAdminEmails") || undefined,
  monthlyBudgetUsd: Number(ctx("monthlyBudgetUsd") ?? 75),
  desiredCount: Number(ctx("desiredCount") ?? 1),
});
