package test

import (
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/gruntwork-io/terratest/modules/aws"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

var assumeRoleArn = os.Getenv("SANDBOX_ORG_ROLE_ARN")

const testSsmValue = "IamAtestSsmParameter"
const region = "us-east-1"

var seededRand = rand.New(rand.NewSource(time.Now().UnixNano()))

// RandomString does example what it says!
func RandomString(length int) string {
	charset := "abcdefghijklmnopqrstuvwxyz"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(b)
}

// TestModule - Our test entry point
func TestModule(t *testing.T) {

	postfix := RandomString(8)

	positiveTestSsmParameterName := "/modules-avst-secret-generator/tests/test-1-" + postfix
	positiveTestExistingSsmParameterName := "/modules-avst-secret-generator/tests/test-2-" + postfix
	positiveTestExistingReplaceSsmParameterName := "/modules-avst-secret-generator/tests/test-3-" + postfix
	positiveTestSsmParameterNameMultipleRegions := "/modules-avst-secret-generator/tests/test-4-" + postfix
	positiveTestExistingSsmParameterNameMultipleRegions := "/modules-avst-secret-generator/tests/test-5-" + postfix
	positiveTestExistingSsmParameterNameMultipleRegionsIgnoreInitialValue := "/modules-avst-secret-generator/tests/test-6-" + postfix

	// Terraforming
	terraformOptions := &terraform.Options{
		NoColor: true,
		Lock:    true,
		BackendConfig: map[string]interface{}{
			"key":      "modules/modules-avst-secret-generator/tests/fixures/default/" + postfix,
			"role_arn": assumeRoleArn,
		},
		TerraformDir: "fixture",
		Vars: map[string]interface{}{
			"positive_test_ssm_parameter_name":                                           positiveTestSsmParameterName,
			"positive_test_existing_ssm_parameter_name":                                  positiveTestExistingSsmParameterName,
			"positive_test_existing_replace_ssm_parameter_name":                          positiveTestExistingReplaceSsmParameterName,
			"positive_test_ssm_parameter_multiple_regions":                               positiveTestSsmParameterNameMultipleRegions,
			"positive_test_existing_ssm_parameter_multiple_regions":                      positiveTestExistingSsmParameterNameMultipleRegions,
			"positive_test_existing_ssm_parameter_multiple_regions_ignore_initial_value": positiveTestExistingSsmParameterNameMultipleRegionsIgnoreInitialValue,
			"aws_region": region,
			"regions":    "[\"us-east-1\", \"eu-west-1\"]",
		},
	}

	// create existing values
	aws.PutParameter(t, region, positiveTestExistingSsmParameterName, "Existing SSM param, this should not have its value replaced", testSsmValue)
	aws.PutParameter(t, region, positiveTestExistingReplaceSsmParameterName, "Existing SSM param, this SHOULD have its value replaced", testSsmValue)
	aws.PutParameter(t, region, positiveTestExistingSsmParameterNameMultipleRegions, "Existing SSM param, this SHOULD NOT have its value replaced", testSsmValue)
	aws.PutParameter(t, region, positiveTestExistingSsmParameterNameMultipleRegionsIgnoreInitialValue, "Existing SSM param, this SHOULD have its value replaced", testSsmValue)

	// setup TF stack
	defer terraform.Destroy(t, terraformOptions)

	// One failure for trying to create a parameter in a second region when there's already a parameter in the first region
	_, fail := terraform.InitAndApplyE(t, terraformOptions)
	assert.Error(t, fail, "")

	// Assertions
	assert.NotNil(t, aws.GetParameter(t, region, positiveTestSsmParameterName))
	assert.Equal(t, aws.GetParameter(t, region, positiveTestExistingSsmParameterName), testSsmValue)
	assert.NotEqual(t, aws.GetParameter(t, region, positiveTestExistingReplaceSsmParameterName), testSsmValue)
	assert.NotNil(t, aws.GetParameter(t, region, positiveTestSsmParameterNameMultipleRegions))

	// Non-existent parameters in any of the regions - should be created and values should match
	assert.NotNil(t, aws.GetParameter(t, "eu-west-1", positiveTestSsmParameterNameMultipleRegions))
	assert.Equal(t, aws.GetParameter(t, region, positiveTestSsmParameterNameMultipleRegions), aws.GetParameter(t, "eu-west-1", positiveTestSsmParameterNameMultipleRegions))

	// Initial parameter is there and upon stack deletion the parameter should not be removed
	assert.Equal(t, aws.GetParameter(t, region, positiveTestExistingSsmParameterNameMultipleRegions), testSsmValue)
	_, e := aws.GetParameterE(t, "eu-west-1", positiveTestExistingSsmParameterNameMultipleRegions)
	assert.Error(t, e, "ParameterNotFound")

	terraform.Destroy(t, terraformOptions)

	//confirm ssm parameters are gone after destroy

	var _, error1 = aws.GetParameterE(t, region, positiveTestSsmParameterName)
	assert.Error(t, error1, "ParameterNotFound")

	var _, error2 = aws.GetParameterE(t, region, positiveTestExistingSsmParameterName)
	assert.Error(t, error2, "ParameterNotFound")

	var _, error3 = aws.GetParameterE(t, region, positiveTestExistingReplaceSsmParameterName)
	assert.Error(t, error3, "ParameterNotFound")

	var _, error5 = aws.GetParameterE(t, "eu-west-1", positiveTestSsmParameterNameMultipleRegions)
	assert.Error(t, error5, "ParameterNotFound")

	var _, error6 = aws.GetParameterE(t, region, positiveTestExistingSsmParameterNameMultipleRegionsIgnoreInitialValue)
	assert.Error(t, error6, "ParameterNotFound")

	var _, error7 = aws.GetParameterE(t, "eu-west-1", positiveTestExistingSsmParameterNameMultipleRegionsIgnoreInitialValue)
	assert.Error(t, error7, "ParameterNotFound")
}
