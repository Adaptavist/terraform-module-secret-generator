variable "aws_region" {
  default = "us-east-1"
}

variable "lambda_name" {
  default = "ssm-secret-generator"
}

variable "namespace" {
  type = string
}

variable "stage" {
  type = string
}

variable "tags" {
  type = map(string)
}