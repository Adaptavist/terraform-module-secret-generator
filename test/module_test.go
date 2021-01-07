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

const testSsmValue = "IamAtestSsmParmeter"
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
			"positive_test_ssm_parameter_name":                  positiveTestSsmParameterName,
			"positive_test_existing_ssm_parameter_name":         positiveTestExistingSsmParameterName,
			"positive_test_existing_replace_ssm_parameter_name": positiveTestExistingReplaceSsmParameterName,
			"aws_region": region,
		},
	}

	// create existing values
	aws.PutParameter(t, region, positiveTestExistingSsmParameterName, "Existing SSM param, this should not have its value replaced", testSsmValue)
	aws.PutParameter(t, region, positiveTestExistingReplaceSsmParameterName, "Existing SSM param, this SHOULD have its value replaced", testSsmValue)

	// setup TF stack
	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	//assert stuff
	assert.NotNil(t, aws.GetParameter(t, region, positiveTestSsmParameterName))
	assert.Equal(t, aws.GetParameter(t, region, positiveTestExistingSsmParameterName), testSsmValue)
	assert.NotEqual(t, aws.GetParameter(t, region, positiveTestExistingReplaceSsmParameterName), testSsmValue)

	terraform.Destroy(t, terraformOptions)

	//confirm ssm paramters are gone after destroy

	var _, error1 = aws.GetParameterE(t, region, positiveTestSsmParameterName)
	assert.Error(t, error1, "ParameterNotFound")

	var _, error2 = aws.GetParameterE(t, region, positiveTestExistingSsmParameterName)
	assert.Error(t, error2, "ParameterNotFound")

	var _, error3 = aws.GetParameterE(t, region, positiveTestExistingReplaceSsmParameterName)
	assert.Error(t, error3, "ParameterNotFound")
}