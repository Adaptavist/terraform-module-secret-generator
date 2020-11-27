terraform {
  backend "s3" {
    bucket         = "product-sandbox-terraform-state-management"
    dynamodb_table = "product-sandbox-terraform-state-management"
    region         = "us-east-1"
    encrypt        = "true"
  }
}

locals {

  stage = "sandbox"
  tags = {
    "Avst:BusinessUnit" : "platform"
    "Avst:Team" : "cloud-infra"
    "Avst:CostCenter" : "foo"
    "Avst:Project" : "foo"
    "Avst:Stage:Type" : local.stage
  }
}

provider "aws" {
  region = var.aws_region
}

resource "random_string" "random" {
  length  = 6
  special = false
}

module lambda {
  source      = "../../infra"
  namespace   = "test"
  aws_region  = var.aws_region
  lambda_name = "ssm-secret-generator-${random_string.random.result}"
  stage       = local.stage
  tags        = local.tags
}

module positive_test_ssm_parameter {
  source  = "Adaptavist/aws-secret/module"
  version = "1.0.1"

  secret_lambda_function_name = "${module.lambda.lambda_name}"
  secret_ssm_path             = var.positive_test_ssm_parameter_name
  tags                        = local.tags
  stage                       = local.stage

  depends_on = [module.lambda]
}

module positive_test_existing_ssm_parameter {
  source  = "Adaptavist/aws-secret/module"
  version = "1.0.1"

  secret_lambda_function_name = "${module.lambda.lambda_name}"
  secret_ssm_path             = var.positive_test_existing_ssm_parameter_name
  tags                        = local.tags
  stage                       = local.stage

  respect_initial_value = true

  depends_on = [module.lambda]
}

module positive_test_existing_replace_ssm_parameter {
  source  = "Adaptavist/aws-secret/module"
  version = "1.0.1"

  secret_lambda_function_name = "${module.lambda.lambda_name}"
  secret_ssm_path             = var.positive_test_existing_replace_ssm_parameter_name
  tags                        = local.tags
  stage                       = local.stage

  respect_initial_value = false

  depends_on = [module.lambda]
}