import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type * as ecr from "aws-cdk-lib/aws-ecr";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaDestinations from "aws-cdk-lib/aws-lambda-destinations";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cr from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

const REPO_ROOT = path.join(__dirname, "..", "..");

export interface AppStackProps extends StackProps {
  appName: string;
  isProd: boolean;
  vpc: ec2.IVpc;
  db: rds.DatabaseInstance;
  dbSecurityGroup: ec2.ISecurityGroup;
  repository: ecr.IRepository;
  imageTag?: string;
  webAclArn: string;
  alarmEmail?: string;
  mailFrom?: string;
  bootstrapAdminEmails?: string;
  monthlyBudgetUsd: number;
  desiredCount: number;
}

/**
 * Everything that serves users:
 *   CloudFront (+WAF) ─┬─ /*            → ALB → ECS Fargate (Next.js)
 *                      └─ /media/*      → S3 (OAC, processed images only)
 *   Cognito (Hosted UI), SES (email), Secrets Manager
 *   Lambdas: image-processor (S3 event), tour-reminders (EventBridge Scheduler)
 *   CloudWatch alarms → SNS email, AWS Budgets alarm
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { appName, isProd } = props;
    const removal = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // ───────────────────────────── Secrets ─────────────────────────────
    const genSecret = (name: string, description: string) =>
      new secretsmanager.Secret(this, name, {
        secretName: `${appName}/${name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`,
        description,
        generateSecretString: { passwordLength: 64, excludePunctuation: true },
      });
    const sessionSecret = genSecret("SessionSecret", "Signs GharKhoj session cookies (HS256)");
    const internalSecret = genSecret("InternalApiSecret", "Shared secret for Lambda → app internal API calls");
    const originVerifySecret = genSecret("OriginVerify", "Header value proving a request came through CloudFront");

    // ─────────────────────────── Media bucket ───────────────────────────
    const bucket = new s3.Bucket(this, "Media", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: removal,
      autoDeleteObjects: !isProd,
      lifecycleRules: [
        { id: "abort-multipart", abortIncompleteMultipartUploadAfter: Duration.days(1) },
        // Originals are only needed for re-processing; processed variants live under media/.
        { id: "expire-originals", prefix: "uploads/", expiration: Duration.days(180) },
      ],
    });

    // ───────────────────────────── Network ─────────────────────────────
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc: props.vpc,
      description: "ALB: CloudFront origin-facing IPs only",
      allowAllOutbound: true,
    });
    const cfPrefixList = ec2.PrefixList.fromLookup(this, "CloudFrontOriginFacing", {
      prefixListName: "com.amazonaws.global.cloudfront.origin-facing",
    });
    albSg.addIngressRule(ec2.Peer.prefixList(cfPrefixList.prefixListId), ec2.Port.tcp(80), "CloudFront → ALB");

    const serviceSg = new ec2.SecurityGroup(this, "ServiceSg", {
      vpc: props.vpc,
      description: "ECS tasks",
      allowAllOutbound: true,
    });
    serviceSg.addIngressRule(albSg, ec2.Port.tcp(3000), "ALB → app");
    // Defined here (not in DataStack) to avoid a cross-stack dependency cycle.
    new ec2.CfnSecurityGroupIngress(this, "DbFromApp", {
      groupId: props.dbSecurityGroup.securityGroupId,
      sourceSecurityGroupId: serviceSg.securityGroupId,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      description: "App → Postgres",
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg,
      dropInvalidHeaderFields: true,
      idleTimeout: Duration.seconds(60),
    });

    // ──────────────────────────── CloudFront ────────────────────────────
    const originVerify = originVerifySecret.secretValue.unsafeUnwrap(); // resolved by CloudFormation dynamic reference
    const albOrigin = new origins.LoadBalancerV2Origin(alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      customHeaders: { "X-Origin-Verify": originVerify },
      readTimeout: Duration.seconds(30),
    });
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: `${appName} web + media`,
      defaultBehavior: {
        origin: albOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // Only responses the app marks `public, s-maxage` are cached; everything else passes through.
        cachePolicy: cloudfront.CachePolicy.USE_ORIGIN_CACHE_CONTROL_HEADERS_QUERY_STRINGS,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: true,
      },
      additionalBehaviors: {
        "/media/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        "/_next/static/*": {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      webAclId: props.webAclArn,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes India edge locations closest to Nepal
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });
    const appUrl = `https://${distribution.distributionDomainName}`;

    // CloudFront may read ONLY processed media — never originals (uploads/) or verification docs (private/).
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        notResources: [bucket.arnForObjects("media/*")],
      }),
    );
    // Browser uploads go straight to S3 via presigned POST: CORS limited to the app origin.
    // Applied with a custom resource because the bucket and distribution reference each other.
    new cr.AwsCustomResource(this, "MediaCors", {
      onUpdate: {
        service: "S3",
        action: "putBucketCors",
        parameters: {
          Bucket: bucket.bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [appUrl],
                AllowedMethods: ["POST", "GET", "HEAD"],
                AllowedHeaders: ["*"],
                MaxAgeSeconds: 3000,
              },
            ],
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of(`${bucket.bucketName}-cors`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({ actions: ["s3:PutBucketCORS"], resources: [bucket.bucketArn] }),
      ]),
      installLatestAwsSdk: false,
    });

    // ───────────────────────────── Cognito ─────────────────────────────
    const userPool = new cognito.UserPool(this, "Users", {
      userPoolName: `${appName}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
        phoneNumber: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      // Email OTP is standard; SMS/TOTP MFA optional (SMS to Nepal requires SNS sandbox exit — see runbook).
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: true, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: isProd,
      removalPolicy: removal,
    });
    for (const group of ["renter", "landlord", "admin"]) {
      new cognito.CfnUserPoolGroup(this, `Group-${group}`, {
        userPoolId: userPool.userPoolId,
        groupName: group,
        description: `GharKhoj ${group}s`,
      });
    }
    const domain = userPool.addDomain("HostedUi", { cognitoDomain: { domainPrefix: `${appName}-${this.account}` } });
    const client = userPool.addClient("WebClient", {
      userPoolClientName: `${appName}-web`,
      generateSecret: true, // confidential client: code exchange happens server-side
      authFlows: {},
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
        ],
        callbackUrls: [`${appUrl}/api/v1/auth/callback`],
        logoutUrls: [`${appUrl}/`],
      },
      preventUserExistenceErrors: true,
      idTokenValidity: Duration.hours(1),
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });
    const clientSecret = new secretsmanager.Secret(this, "CognitoClientSecret", {
      secretName: `${appName}/cognito-client-secret`,
      secretStringValue: client.userPoolClientSecret,
    });

    // ─────────────────────────────── SES ───────────────────────────────
    const mailFrom = props.mailFrom || `no-reply@example.com`;
    const senderEmail = mailFrom.match(/<([^>]+)>/)?.[1] ?? mailFrom;
    if (props.mailFrom) new ses.EmailIdentity(this, "SenderIdentity", { identity: ses.Identity.email(senderEmail) });

    // ─────────────────────────── ECS Fargate ───────────────────────────
    // ECS Exec sessions are logged to a dedicated group (also scopes the task role's logs permissions).
    const execLogGroup = new logs.LogGroup(this, "ExecLogs", {
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
      executeCommandConfiguration: {
        logging: ecs.ExecuteCommandLogging.OVERRIDE,
        logConfiguration: { cloudWatchLogGroup: execLogGroup },
      },
    });
    const taskDef = new ecs.FargateTaskDefinition(this, "WebTask", {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    const image = props.imageTag
      ? ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag)
      : ecs.ContainerImage.fromAsset(REPO_ROOT, {
          platform: Platform.LINUX_ARM64,
          exclude: ["infra/cdk.out", "node_modules", ".next"],
        });
    const logGroup = new logs.LogGroup(this, "WebLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const dbSecret = props.db.secret!;

    const container = taskDef.addContainer("web", {
      image,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "web" }),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        APP_URL: appUrl,
        AWS_REGION: this.region,
        LOG_LEVEL: "info",
        AUTH_MODE: "cognito",
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: client.userPoolClientId,
        COGNITO_DOMAIN: domain.baseUrl(),
        S3_BUCKET: bucket.bucketName,
        MEDIA_BASE_URL: appUrl, // same origin: /media/* is served by CloudFront from S3
        IMAGE_PROCESSING: "lambda",
        MODERATION: "rekognition",
        MAIL_TRANSPORT: "ses",
        MAIL_FROM: `GharKhoj <${senderEmail}>`,
        SMS_ENABLED: "false",
        GEOCODER_USER_AGENT: `GharKhoj/1.0 (${props.alarmEmail || senderEmail})`,
        BOOTSTRAP_ADMIN_EMAILS: props.bootstrapAdminEmails ?? "",
        DB_HOST: props.db.dbInstanceEndpointAddress,
        DB_PORT: props.db.dbInstanceEndpointPort,
        DB_NAME: "gharkhoj",
        RUN_MIGRATIONS: "true",
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbSecret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
        SESSION_SECRET: ecs.Secret.fromSecretsManager(sessionSecret),
        INTERNAL_API_SECRET: ecs.Secret.fromSecretsManager(internalSecret),
        COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(clientSecret),
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        startPeriod: Duration.seconds(60),
        retries: 3,
      },
      readonlyRootFilesystem: false,
    });
    void container;

    // Least-privilege task role (CLAUDE.md §9b).
    const taskRole = taskDef.taskRole;
    bucket.grantPut(taskRole, "uploads/*"); // presigned POST is signed with these credentials
    bucket.grantReadWrite(taskRole, "private/*"); // verification documents
    bucket.grantRead(taskRole, "uploads/*");
    bucket.grantDelete(taskRole, "uploads/*");
    bucket.grantDelete(taskRole, "media/*");
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
      }),
    );
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminDeleteUser",
        ],
        resources: [userPool.userPoolArn],
      }),
    );
    // SNS SMS publishes to phone numbers, which have no ARN; only enabled when SMS_ENABLED=true.
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: ["*"],
        conditions: { Bool: { "aws:SecureTransport": "true" } },
      }),
    );

    const service = new ecs.FargateService(this, "WebService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: props.desiredCount,
      securityGroups: [serviceSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { enable: true, rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: Duration.seconds(90),
      enableExecuteCommand: true, // break-glass shell for ops (audited via CloudTrail)
    });
    const scaling = service.autoScaleTaskCount({ minCapacity: props.desiredCount, maxCapacity: 4 });
    scaling.scaleOnCpuUtilization("Cpu", {
      targetUtilizationPercent: 60,
      scaleOutCooldown: Duration.seconds(60),
      scaleInCooldown: Duration.minutes(5),
    });

    const listener = alb.addListener("Http", {
      port: 80,
      open: false,
      defaultAction: elbv2.ListenerAction.fixedResponse(403, { contentType: "text/plain", messageBody: "Forbidden" }),
    });
    const targetGroup = listener.addTargets("Web", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      priority: 1,
      conditions: [elbv2.ListenerCondition.httpHeader("X-Origin-Verify", [originVerify])],
      healthCheck: {
        path: "/api/health",
        healthyHttpCodes: "200",
        interval: Duration.seconds(20),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: Duration.seconds(20),
    });

    // ───────────────────────────── Lambdas ─────────────────────────────
    const lambdaDlq = new sqs.Queue(this, "LambdaDlq", { retentionPeriod: Duration.days(14), enforceSSL: true });

    const imageFn = new NodejsFunction(this, "ImageProcessor", {
      description: "Resize/strip EXIF/WebP + Rekognition moderation for uploaded listing media",
      entry: path.join(REPO_ROOT, "lambdas/image-processor/src/handler.ts"),
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, "pnpm-lock.yaml"),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1536,
      timeout: Duration.seconds(60),
      retryAttempts: 2,
      onFailure: new lambdaDestinations.SqsDestination(lambdaDlq),
      logGroup: new logs.LogGroup(this, "ImageProcessorLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: { APP_URL: appUrl, INTERNAL_SECRET_ARN: internalSecret.secretArn, MODERATION: "rekognition" },
      bundling: {
        format: OutputFormat.CJS,
        target: "node22",
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*", "sharp"],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          // sharp ships native binaries: install the linux-arm64 build next to the bundle.
          afterBundling: (_in: string, outputDir: string) => [
            `cd "${outputDir}" && npm init -y >/dev/null && npm install --no-save --no-audit --no-fund --os=linux --cpu=arm64 --libc=glibc sharp@0.35.5 >/dev/null`,
          ],
        },
      },
    });
    bucket.grantRead(imageFn, "uploads/*");
    bucket.grantPut(imageFn, "media/*");
    internalSecret.grantRead(imageFn);
    // Rekognition DetectModerationLabels does not support resource-level permissions.
    imageFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["rekognition:DetectModerationLabels"], resources: ["*"] }),
    );
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(imageFn), {
      prefix: "uploads/listings/",
    });

    const remindersFn = new NodejsFunction(this, "TourReminders", {
      description: "Sends 24h/2h tour reminders via the app's internal API",
      entry: path.join(REPO_ROOT, "lambdas/tour-reminders/src/handler.ts"),
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, "pnpm-lock.yaml"),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(60),
      retryAttempts: 0,
      logGroup: new logs.LogGroup(this, "TourRemindersLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: { APP_URL: appUrl, INTERNAL_SECRET_ARN: internalSecret.secretArn },
      bundling: { format: OutputFormat.CJS, target: "node22", minify: true, externalModules: ["@aws-sdk/*"] },
    });
    internalSecret.grantRead(remindersFn);
    const schedulerRole = new iam.Role(this, "SchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    remindersFn.grantInvoke(schedulerRole);
    new scheduler.CfnSchedule(this, "TourReminderSchedule", {
      description: "Tour reminders every 15 minutes",
      scheduleExpression: "rate(15 minutes)",
      flexibleTimeWindow: { mode: "OFF" },
      target: {
        arn: remindersFn.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: { maximumRetryAttempts: 1 },
      },
    });

    // ─────────────────────── Alarms & cost guardrails ───────────────────────
    const alarmTopic = new sns.Topic(this, "Alarms", { displayName: `${appName} alarms` });
    if (props.alarmEmail) alarmTopic.addSubscription(new subs.EmailSubscription(props.alarmEmail));
    const notify = (alarm: cloudwatch.Alarm) => {
      alarm.addAlarmAction(new cwActions.SnsAction(alarmTopic));
      alarm.addOkAction(new cwActions.SnsAction(alarmTopic));
    };
    notify(
      targetGroup.metrics
        .httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, { period: Duration.minutes(5), statistic: "Sum" })
        .createAlarm(this, "App5xx", {
          alarmDescription: "More than 10 server errors in 5 minutes",
          threshold: 10,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
    );
    notify(
      targetGroup.metrics
        .targetResponseTime({ period: Duration.minutes(5), statistic: "p95" })
        .createAlarm(this, "AppLatencyP95", {
          alarmDescription: "p95 latency above 2s for 15 minutes",
          threshold: 2,
          evaluationPeriods: 3,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
    );
    notify(
      targetGroup.metrics.unhealthyHostCount({ period: Duration.minutes(1) }).createAlarm(this, "UnhealthyTasks", {
        alarmDescription: "At least one unhealthy web task for 5 minutes",
        threshold: 1,
        evaluationPeriods: 5,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      }),
    );
    notify(
      props.db
        .metricCPUUtilization({ period: Duration.minutes(5) })
        .createAlarm(this, "DbCpu", { threshold: 80, evaluationPeriods: 3, alarmDescription: "RDS CPU > 80%" }),
    );
    notify(
      props.db.metricFreeStorageSpace({ period: Duration.minutes(15) }).createAlarm(this, "DbStorage", {
        threshold: 2 * 1024 ** 3,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        alarmDescription: "RDS free storage < 2 GB",
      }),
    );
    notify(
      imageFn
        .metricErrors({ period: Duration.minutes(5) })
        .createAlarm(this, "ImageFnErrors", {
          threshold: 5,
          evaluationPeriods: 1,
          alarmDescription: "Image processing errors",
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
    );
    notify(
      remindersFn
        .metricErrors({ period: Duration.minutes(30) })
        .createAlarm(this, "ReminderFnErrors", {
          threshold: 2,
          evaluationPeriods: 1,
          alarmDescription: "Tour reminder job failing",
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
    );
    notify(
      lambdaDlq
        .metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) })
        .createAlarm(this, "DlqNotEmpty", {
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          alarmDescription: "Failed Lambda events in DLQ",
        }),
    );

    if (props.alarmEmail) {
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: `${appName}-monthly`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: "ACTUAL",
              comparisonOperator: "GREATER_THAN",
              threshold: 80,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ subscriptionType: "EMAIL", address: props.alarmEmail }],
          },
          {
            notification: {
              notificationType: "FORECASTED",
              comparisonOperator: "GREATER_THAN",
              threshold: 100,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ subscriptionType: "EMAIL", address: props.alarmEmail }],
          },
        ],
      });
    }

    const dashboard = new cloudwatch.Dashboard(this, "Dashboard", { dashboardName: `${appName}-overview` });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Requests & 5xx",
        left: [targetGroup.metrics.requestCount()],
        right: [targetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT)],
      }),
      new cloudwatch.GraphWidget({
        title: "Latency p95 (s)",
        left: [targetGroup.metrics.targetResponseTime({ statistic: "p95" })],
      }),
      new cloudwatch.GraphWidget({
        title: "ECS CPU / Memory",
        left: [service.metricCpuUtilization()],
        right: [service.metricMemoryUtilization()],
      }),
      new cloudwatch.GraphWidget({
        title: "RDS CPU / Connections",
        left: [props.db.metricCPUUtilization()],
        right: [props.db.metricDatabaseConnections()],
      }),
    );

    // ───────────────────────────── Outputs ─────────────────────────────
    new CfnOutput(this, "AppUrl", { value: appUrl, description: "Public URL of GharKhoj" });
    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "MediaBucket", { value: bucket.bucketName });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "CognitoDomain", { value: domain.baseUrl() });
    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "ServiceName", { value: service.serviceName });
    new CfnOutput(this, "AlarmTopicArn", { value: alarmTopic.topicArn });
  }
}
