
variable "positive_test_ssm_parameter_name" {}
variable "positive_test_existing_ssm_parameter_name" {}
variable "positive_test_existing_replace_ssm_parameter_name" {}
variable "positive_test_ssm_parameter_multiple_regions" {}
variable "positive_test_existing_ssm_parameter_multiple_regions" {}
variable "positive_test_existing_ssm_parameter_multiple_regions_ignore_initial_value" {}
variable "aws_region" {}
variable "regions" {
  type    = list(string)
  default = ["us-east-1"]
}
