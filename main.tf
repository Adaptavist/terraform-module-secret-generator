locals {

  stageTag = {
    "Avst:Stage:Name" = var.stage
  }
  finalTags = merge(var.tags, local.stageTag)
}

data "aws_region" "current" {}

module "aws-lambda" {
  source  = "Adaptavist/aws-lambda/module"
  version = "1.11.0"

  function_name   = var.lambda_name
  description     = "A lambda which generates a random string and sets it into a supplied SSM path"
  lambda_code_dir = "${path.module}/typescript/dist"
  handler         = "app.handler"
  runtime         = "nodejs12.x"
  timeout         = "300"

  namespace  = var.namespace
  stage      = var.stage
  tags       = local.finalTags
  aws_region = data.aws_region.current.name
}

resource "aws_iam_role_policy" "lambda_exec_role_policy" {
  name = "secret_generator_lambda_role_policy"
  role = module.aws-lambda.lambda_role_name

  policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": [
          "ssm:*",
          "secretsmanager:GetRandomPassword",
          "iam:Generate*",
          "iam:Get*",
          "iam:List*",
          "logs:*"

        ],
        "Effect": "Allow",
        "Resource": "*"
      }
    ]
  }
  EOF
}
