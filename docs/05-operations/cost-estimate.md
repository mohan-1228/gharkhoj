# Cost Estimate (AWS ap-south-1)

> These are list-price **estimates** for a low-traffic launch (≈ 10k visits/month), not quotes. Prices change; check the AWS Pricing Calculator before committing. Amounts are USD/month.

## Baseline (default configuration)

| Service                        | Configuration                                             | Est. $/mo      |
| ------------------------------ | --------------------------------------------------------- | -------------- |
| NAT Gateway                    | 1 × NAT (hourly) + light data                             | ~41            |
| Application Load Balancer      | 1 ALB + minimal LCUs                                      | ~20            |
| Public IPv4 addresses          | ALB (2) + NAT (1)                                         | ~11            |
| ECS Fargate (ARM64)            | 1 task × 0.5 vCPU / 1 GB, 24×7                            | ~12            |
| RDS PostgreSQL                 | db.t4g.micro single-AZ + 20 GB gp3 + backups              | ~19            |
| AWS WAF                        | 1 web ACL + 5 rules + requests                            | ~11            |
| CloudFront                     | low traffic (always-free tier covers 1 TB / 10M requests) | ~0–2           |
| S3                             | a few GB of images + requests                             | ~1             |
| Secrets Manager                | 6 secrets                                                 | ~2.4           |
| CloudWatch                     | logs (1-month retention), 9 alarms, 1 dashboard           | ~5–8           |
| Lambda + EventBridge Scheduler | image processing + reminders every 15 min                 | ~0–1           |
| Cognito                        | Lite tier, < 10k MAU                                      | 0              |
| SES                            | ~5k emails                                                | ~0.5           |
| Rekognition                    | ~2k images moderated                                      | ~2             |
| ECR                            | a few image versions                                      | ~1             |
| **Total**                      |                                                           | **≈ $125–130** |

The budget alarm defaults to **$150/month** (80% actual and 100% forecast notifications).

## Where the money goes

More than half is **always-on networking** (NAT + ALB + IPv4) that doesn't grow with traffic. Usage-driven costs (Fargate tasks, RDS size, CloudFront egress) grow gradually.

## Ways to save

| Option                                                                                                     | Saving            | Trade-off                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Run tasks in **public subnets** with public IPs and drop the NAT gateway (`natGateways=0` + subnet change) | ~$41              | Tasks get public IPs (still protected by security groups); less defence in depth |
| Use VPC interface endpoints instead of NAT for AWS APIs                                                    | varies            | Each endpoint costs ~$7/mo per AZ, so only worth it for a few services           |
| Fargate **Spot** for a 2nd task                                                                            | ~70% on that task | Can be interrupted (keep 1 on-demand)                                            |
| Stop the dev environment outside working hours                                                             | up to ~60%        | Manual or scheduled                                                              |
| RDS **reserved instance** (1 yr)                                                                           | ~30–40% on RDS    | Commitment                                                                       |
| Compute Savings Plan                                                                                       | ~20% on Fargate   | Commitment                                                                       |

## Scaling outlook

| Traffic                 | Changes                                                 | Rough total |
| ----------------------- | ------------------------------------------------------- | ----------- |
| Launch (10k visits/mo)  | as above                                                | ~$130       |
| Growth (200k visits/mo) | 2 tasks avg, db.t4g.small, more CloudFront/WAF requests | ~$190–230   |
| Scale (2M visits/mo)    | 3–4 tasks, db.t4g.medium Multi-AZ, read replica         | ~$450–600   |
