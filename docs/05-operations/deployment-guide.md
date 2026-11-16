# Deployment Guide — first deploy to AWS and ongoing releases

> **Cost warning:** deploying creates billable resources (≈ US $120–130/month baseline; see [cost estimate](cost-estimate.md)). Destroy with `pnpm cdk destroy --all` when you're done experimenting.

## 0. Prerequisites

| Tool                                                            | Version                                       |
| --------------------------------------------------------------- | --------------------------------------------- |
| AWS account + CLI v2, admin credentials for the first bootstrap | `aws sts get-caller-identity` works           |
| Node.js 22 + pnpm 9                                             | `nvm use` (reads `.nvmrc`), `npm i -g pnpm@9` |
| Docker Desktop (for the first, local deploy)                    | running                                       |
| GitHub repository                                               | e.g. `mohan-1228/gharkhoj`                    |

Region: **ap-south-1 (Mumbai)**, the closest AWS region to Nepal. WAF for CloudFront is created in **us-east-1** automatically.

## 1. One-time account setup

```bash
cd infra
pnpm install
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
# Bootstrap both regions (CDK assets + deploy roles)
pnpm cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/ap-south-1 aws://$CDK_DEFAULT_ACCOUNT/us-east-1
```

## 2. Configure

Edit `infra/cdk.json → context` or pass `-c key=value`:

| Key                                                | Meaning                                                            | Example                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `alarmEmail`                                       | Receives alarms + budget alerts (confirm the SNS email!)           | `ops@yourdomain.com`                                               |
| `mailFrom`                                         | Sender for transactional email (verified in SES)                   | `GharKhoj <no-reply@yourdomain.com>`                               |
| `bootstrapAdminEmails`                             | Comma-separated emails that become admin on first verified sign-in | `you@gmail.com`                                                    |
| `githubRepo`                                       | `owner/repo` allowed to deploy via OIDC                            | `mohan-1228/gharkhoj`                                              |
| `monthlyBudgetUsd`                                 | Budget alarm threshold                                             | `150`                                                              |
| `natGateways` / `dbInstanceClass` / `desiredCount` | Sizing                                                             | `1` / `t4g.micro` / `1`                                            |
| `githubOidcProviderArn`                            | Only if your account already has the GitHub OIDC provider          | `arn:aws:iam::…:oidc-provider/token.actions.githubusercontent.com` |

## 3. First deploy (from your machine)

```bash
cd infra
pnpm cdk diff                      # review every change first
pnpm cdk deploy --all \
  -c alarmEmail=you@example.com \
  -c mailFrom="GharKhoj <you@example.com>" \
  -c bootstrapAdminEmails=you@example.com
```

Without `imageTag`, CDK builds the Docker image locally (linux/arm64) and pushes it to the CDK asset repository. The first deploy takes ~25–35 minutes (CloudFront and RDS are the slow parts).

Outputs (also in the CloudFormation console):
`AppUrl`, `UserPoolId`, `CognitoDomain`, `MediaBucket`, `DistributionId`, `ClusterName`, `ServiceName`, `DeployRoleArn`, `EcrRepositoryUri`.

## 4. Post-deploy steps (one time)

1. **Confirm emails:** click the SNS subscription email (alarms) and the SES verification email (sender identity).
2. **SES production access:** new accounts are in the SES _sandbox_ and can only email verified addresses. Request production access in the SES console (use case: transactional emails for tour requests and listing moderation). Until then, verify test recipients manually.
3. **First admin:** open `AppUrl` → Sign in → create an account with an email listed in `bootstrapAdminEmails` and verify it. You'll be promoted to admin and the action is audit-logged.
4. **(Optional) SMS:** request SNS SMS production access + spend limit, test delivery to NTC/Ncell numbers, then set `SMS_ENABLED=true` in the task definition.
5. **Smoke test:** run the post-deploy checklist in [release-checklist.md](release-checklist.md).

## 5. Enable CI/CD (GitHub Actions)

1. Push the repository to GitHub (`main` and `develop` branches).
2. Repository → Settings → Environments → create **`production`** (add yourself as a required reviewer for manual approval).
3. Repository → Settings → Variables (Actions):

| Variable                                             | Value                                   |
| ---------------------------------------------------- | --------------------------------------- |
| `AWS_ACCOUNT_ID`                                     | your account id                         |
| `AWS_REGION`                                         | `ap-south-1`                            |
| `AWS_DEPLOY_ROLE_ARN`                                | `DeployRoleArn` output of `gharkhoj-ci` |
| `ALARM_EMAIL`, `MAIL_FROM`, `BOOTSTRAP_ADMIN_EMAILS` | as above                                |

4. From now on: PR → `CI` workflow; merge to `main` → `CI` → `Deploy` (build arm64 image tagged with the commit SHA → ECR → `cdk deploy -c imageTag=<sha>` → smoke test asserts `/api/health` reports that SHA).

No AWS keys are stored in GitHub: the workflow assumes the IAM role through OIDC, and that role is only trusted for `main` / `production`.

## 6. Custom domain (optional, recommended before public launch)

1. Register or transfer the domain to Route 53 (or delegate a subdomain).
2. Request an ACM certificate in **us-east-1** for `www.example.com` (CloudFront) and one in **ap-south-1** for the ALB origin.
3. Add `domainNames` + `certificate` to the CloudFront distribution, switch the ALB listener to HTTPS (443) and the origin to `HTTPS_ONLY`, add Route 53 alias records, and update the Cognito callback/logout URLs. (Planned as a CDK context flag; see the [roadmap](../06-release/roadmap.md).)

## 7. Rollback

- **Automatic:** the ECS deployment circuit breaker rolls back if new tasks fail health checks.
- **Manual:** re-run the `Deploy` workflow for a previous commit (`workflow_dispatch` on that SHA), or `pnpm cdk deploy gharkhoj-app -c imageTag=<previous-sha>`.
- **Database:** migrations are forward-only. Write additive migrations; for emergencies restore RDS to a point in time (see the [runbook](runbook.md)).

## 8. Tear down

```bash
cd infra && pnpm cdk destroy --all
```

In `prod` mode the RDS instance (deletion protection + final snapshot), the media bucket, the user pool and the ECR repository are **retained** to prevent accidental data loss; delete them manually if you really want them gone.
