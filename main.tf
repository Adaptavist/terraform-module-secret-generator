locals {

  stageTag = {
    "Avst:Stage:Name" = var.stage
  }

  finalTags = merge(var.tags, local.stageTag)
}

resource "null_resource" "lambda_dist" {
  provisioner "local-exec" {
    command = "cd ${path.module}/typescript/ && npm install && npm run-script build"
  }
  triggers = {
    always_run = timestamp()
  }
}

module "aws-lambda" {
  source  = "Adaptavist/aws-lambda/module"
  version = "1.5.0"

  function_name   = "${var.lambda_name}-${var.stage}"
  description     = "A lambda which generates a random string and sets it into a supplied SSM path"
  lambda_code_dir = "node_modules/password-secret-setter/dist"
  handler         = "app.handler"
  runtime         = "nodejs10.x"
  timeout         = "300"

  namespace = var.namespace
  stage     = var.stage
  tags      = local.finalTags

  depends_on = [null_resource.lambda_dist]
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