# Secrets Generator Lambda

This module creates a lambda which generates secret values and stores them in SSM. The module requires npm to be installed on the machine which issues the Terraform commands when the module in use.

## Variables

| Name          | Description                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| lambda_name   | The name of lambda which is used, the stage name is appended to end of this to keep stages separate.                                                                                       |
| namespace     | The namespace of the lambda                                                                                                                                        |
| stage         | The stage of the lambda                                                                                                                                            |
| secret_length | The length of the secret that should be generated.                                                                                                                 |
| tags          | Tags applied to the distribution, these should follow what is defined [here](https://github.com/Adaptavist/terraform-compliance/blob/master/features/tags.feature) |
