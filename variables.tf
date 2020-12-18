variable "lambda_name" {
  default     = "ssm-secret-generator"
  description = "Name given to the Lambda which generates secrets"
}

variable "namespace" {
  type        = string
  description = "Namespace used for the Lambda, this is used for tagging and within the Lambda name"
}

variable "stage" {
  type        = string
  description = "The stage of the distribution - (dev, staging etc)."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the distribution, these should follow what is defined [here](https://github.com/Adaptavist/terraform-compliance/blob/master/features/tags.feature)."
}