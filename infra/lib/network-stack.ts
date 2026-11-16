import { Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type { Construct } from "constructs";

/**
 * VPC across 2 AZs:
 *  - public subnets: ALB, NAT gateway
 *  - private (egress) subnets: ECS tasks (outbound to Cognito/SES/Nominatim via NAT)
 *  - isolated subnets: RDS (no internet route at all)
 * One NAT gateway by default to control cost; set natGateways=2 for AZ-redundant egress.
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: StackProps & { natGateways: number }) {
    super(scope, id, props);
    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: props.natGateways,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 22 },
        { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      gatewayEndpoints: { S3: { service: ec2.GatewayVpcEndpointAwsService.S3 } }, // free; keeps S3 traffic off the NAT
    });
    this.vpc.addFlowLog("FlowLogs", { trafficType: ec2.FlowLogTrafficType.REJECT });
  }
}
