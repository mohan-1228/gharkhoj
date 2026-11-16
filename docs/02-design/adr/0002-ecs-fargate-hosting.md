# ADR-0002: Host the web app on ECS Fargate behind CloudFront

**Status:** Accepted (chosen by the product owner) · **Date:** 2026-11-15 · Resolves CLAUDE.md §12.1

## Context

Options were AWS Amplify Hosting, ECS Fargate, or Lambda (API) + static hosting. The app needs private-network access to RDS, long-lived DB connection pools, and `sharp` for local image processing.

## Decision

**ECS Fargate (ARM64/Graviton)** running the Next.js standalone server in Docker, behind an Application Load Balancer, behind CloudFront + WAF.

## Rationale

- Runs inside the VPC → direct private access to RDS (Amplify's SSR compute can't easily reach private subnets).
- The same Docker image runs locally, in CI and in production (parity).
- No cold starts, stable Prisma connection pools (vs. Lambda needing RDS Proxy).
- Fully defined in CDK; rolling deploys with circuit-breaker rollback.

## Consequences

- ⚠️ Fixed baseline cost (~1 task + ALB + NAT) even at zero traffic — see the [cost estimate](../../05-operations/cost-estimate.md).
- ✅ Autoscaling 1→4 tasks on CPU; ECS Exec for break-glass debugging.
