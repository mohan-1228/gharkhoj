import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import type { Construct } from "constructs";

/**
 * Amazon RDS for PostgreSQL 16 (PostGIS is created by the first migration via
 * CREATE EXTENSION). Private isolated subnets, encrypted, automated backups,
 * TLS enforced, credentials generated into Secrets Manager.
 */
export class DataStack extends Stack {
  readonly db: rds.DatabaseInstance;
  readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    props: StackProps & { vpc: ec2.IVpc; instanceClass: string; isProd: boolean },
  ) {
    super(scope, id, props);

    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSg", {
      vpc: props.vpc,
      description: "RDS: only the app can connect",
      allowAllOutbound: false,
    });

    const parameterGroup = new rds.ParameterGroup(this, "Params", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      parameters: { "rds.force_ssl": "1", log_min_duration_statement: "500" },
    });

    this.db = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: new ec2.InstanceType(props.instanceClass),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      databaseName: "gharkhoj",
      // Exclude URL-unsafe punctuation so the password can be embedded in DATABASE_URL.
      credentials: rds.Credentials.fromGeneratedSecret("gharkhoj", {
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\=,.",
      }),
      parameterGroup,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: props.isProd && props.instanceClass !== "t4g.micro", // Multi-AZ off for the small/dev tier
      backupRetention: Duration.days(7),
      preferredBackupWindow: "20:00-20:30", // ~01:45 Nepal time
      deleteAutomatedBackups: false,
      autoMinorVersionUpgrade: true,
      enablePerformanceInsights: false,
      cloudwatchLogsExports: ["postgresql"],
      deletionProtection: props.isProd,
      removalPolicy: props.isProd ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
    });
  }
}
