# Operations Runbook

Quick links (AWS console, region ap-south-1): CloudWatch → Dashboards → `gharkhoj-overview` · ECS → `gharkhoj-app` cluster · RDS → `gharkhoj-data` · CloudWatch Logs `/gharkhoj-app/WebLogs…`.

Every API response carries an `x-request-id`; server-side 500 responses include `requestId` in the body. Search logs by it:

```
fields @timestamp, level, msg, path, status, ms, err.message
| filter requestId = "<id>"
```

## Alarms → what to do

| Alarm                                  | Likely causes                                                                   | First actions                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **App5xx** (>10 server errors / 5 min) | Bad deploy; DB unreachable; Cognito/SES outage                                  | Logs Insights: `filter level >= 50` (error). If it started right after a deploy → roll back (below). Check `/api/health` (`db: down`?). |
| **AppLatencyP95** (>2 s for 15 min)    | Slow query, CPU saturation, cold DB cache                                       | ECS CPU on the dashboard (autoscaling to 4?); RDS CPU / connections; RDS logs (`log_min_duration_statement=500ms`) show slow SQL        |
| **UnhealthyTasks**                     | Task crash loop, failed migration, missing secret                               | ECS → service → Events + stopped task reason; container logs (`applying database migrations` errors)                                    |
| **DbCpu** (>80%)                       | Expensive search pattern, missing index, traffic spike                          | Performance Insights (enable temporarily), slow-query log; consider t4g.small or a read replica                                         |
| **DbStorage** (<2 GB)                  | Growth, logs                                                                    | Storage autoscaling is on (max 100 GB); raise `maxAllocatedStorage`                                                                     |
| **ImageFnErrors / DlqNotEmpty**        | Undecodable upload, Rekognition throttling, callback rejected (secret mismatch) | Lambda logs; inspect the DLQ message; after fixing, re-drive DLQ messages to the function                                               |
| **ReminderFnErrors**                   | App unreachable, secret mismatch                                                | Lambda logs; call `POST /api/v1/internal/tour-reminders` manually with the secret header                                                |
| **Budget 80% / forecast 100%**         | Traffic growth, NAT data, forgotten resources                                   | Cost Explorer by service; see [cost estimate](cost-estimate.md) savings                                                                 |

## Common procedures

### Roll back the web app

```bash
# Option A: GitHub → Actions → Deploy → Run workflow on the last good commit
# Option B (local):
cd infra && pnpm cdk deploy gharkhoj-app -c imageTag=<last-good-sha> --require-approval never
```

### Shell into a running task (break-glass, audited)

```bash
aws ecs execute-command --cluster <ClusterName> --task <taskId> --container web --interactive --command "/bin/sh"
```

### Run a one-off database query

Use ECS Exec, then: `node -e "…"` with Prisma, or `prisma db execute --stdin`. RDS is not reachable from the internet by design.

### Restore the database (point in time)

1. RDS → `gharkhoj-data` instance → _Restore to point in time_ → new instance name.
2. Verify the data on the new instance.
3. Update the `DB_HOST` env in the task definition (or swap instance identifiers), then force a new deployment.
   Backups: automated daily, 7-day retention; the final snapshot is kept on deletion.

### Rotate secrets

| Secret                         | Steps                                                                                                            | Impact                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `gharkhoj/session-secret`      | Secrets Manager → rotate/put new value → ECS _force new deployment_                                              | All users signed out              |
| `gharkhoj/internal-api-secret` | Put new value → force ECS deployment (Lambdas read it fresh on cold start; update their env or wait for recycle) | Brief callback failures → retried |
| DB password                    | Enable RDS-managed rotation, or rotate in Secrets Manager → force ECS deployment                                 | Seconds of connection errors      |
| Origin-verify header           | Put new value → `cdk deploy gharkhoj-app` (updates CloudFront + ALB together)                                    | none                              |

### Promote an admin / handle abuse

Admin console → Users → set role / ban. Banning pauses the user's live listings immediately. Every action is in Admin → Audit log.

### Take down a scam listing fast

Admin → Reports → _Take down listing_, or `POST /api/v1/admin/listings/:id/takedown { reason }`.

### Invalidate CDN cache (rarely needed)

```bash
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

Media paths are content-addressed (new upload = new key), so invalidation is normally unnecessary.

## Data protection requests

- User asks for deletion → they can do it themselves (Account → Delete). For support-assisted deletion: admin sets them banned, then delete via a one-off script using `deleteAccount`.
- Verification documents: delete from `private/verification/<userId>/` in S3 after a decision if your retention policy requires it.

## Severity guide

| Sev  | Definition                                | Response                                      |
| ---- | ----------------------------------------- | --------------------------------------------- |
| SEV1 | Site down / data exposure                 | Immediate; roll back; post-mortem within 48 h |
| SEV2 | Core flow broken (search, tours, sign-in) | Within 1 h                                    |
| SEV3 | Degraded / single feature                 | Next business day                             |
