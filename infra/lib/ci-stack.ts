import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

/**
 * CI/CD plumbing:
 *  - ECR repository for the web image (immutable tags, scan on push, lifecycle)
 *  - GitHub Actions OIDC role: no long-lived AWS keys in GitHub (CLAUDE.md §3).
 *    Trust is limited to this repository's main branch / production environment.
 */
export class CiStack extends Stack {
  readonly repository: ecr.Repository;

  constructor(
    scope: Construct,
    id: string,
    props: StackProps & { appName: string; githubRepo: string; existingOidcProviderArn?: string },
  ) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, "WebRepo", {
      repositoryName: `${props.appName}-web`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ description: "Keep the last 30 images", maxImageCount: 30 }],
    });

    const provider = props.existingOidcProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, "GitHubOidc", props.existingOidcProviderArn)
      : new iam.OpenIdConnectProvider(this, "GitHubOidc", {
          url: "https://token.actions.githubusercontent.com",
          clientIds: ["sts.amazonaws.com"],
        });

    const role = new iam.Role(this, "GitHubDeployRole", {
      roleName: `${props.appName}-github-deploy`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        StringLike: {
          "token.actions.githubusercontent.com:sub": [
            `repo:${props.githubRepo}:ref:refs/heads/main`,
            `repo:${props.githubRepo}:environment:production`,
          ],
        },
      }),
      description: "Assumed by GitHub Actions to push images and run cdk deploy",
    });

    // Push images to this repository only.
    this.repository.grantPullPush(role);
    role.addToPolicy(new iam.PolicyStatement({ actions: ["ecr:GetAuthorizationToken"], resources: ["*"] })); // API has no resource-level support

    // cdk deploy works by assuming the CDK bootstrap roles (least privilege: no direct admin rights).
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );
    // Run the post-deploy smoke test and read stack outputs.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudformation:DescribeStacks"],
        resources: [`arn:aws:cloudformation:*:${this.account}:stack/${props.appName}-*/*`],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", {
      value: role.roleArn,
      description: "Set as AWS_DEPLOY_ROLE_ARN in GitHub repository variables",
    });
    new CfnOutput(this, "EcrRepositoryUri", { value: this.repository.repositoryUri });
  }
}
