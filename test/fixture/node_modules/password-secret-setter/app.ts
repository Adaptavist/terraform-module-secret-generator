import AWS, { SecretsManager } from "aws-sdk";
import { Context, Callback } from "aws-lambda";
import * as cfnResponse from "cfn-response";

var ssm = new AWS.SSM();

export const handler = function (
  event: any,
  context: Context,
  callback: Callback
) {
  function handleError(cause: string) {
    const error = new Error(cause);
    cfnResponse.send(event, context, cfnResponse.FAILED, error);
    callback(error, null);
  }

  function handleSuccess() {
    cfnResponse.send(event, context, cfnResponse.SUCCESS, {});
    callback(null, null);
  }

  const errorCallback = (cause: string): void => {
    handleError(cause);
  };

  const successCallback = (): void => {
    handleSuccess();
  };

  function setSecretValue(
    path: string,
    errorCallBack: (cause: string) => void,
    successCallBack: () => void
  ): void {
    new SecretsManager()
      .getRandomPassword({
        IncludeSpace: includeSpaces,
        PasswordLength: secretLength,
        RequireEachIncludedType: true,
      })
      .send((err, data) => {
        if (err) {
          errorCallBack(`Failed to generate password, cause : ${err}`);
        } else {
          var params = {
            Name: path,
            Value: data.RandomPassword!,
            Overwrite: true,
            Type: "SecureString",
          };

          ssm.putParameter(params, function (err, data) {
            if (err) {
              errorCallBack(`Failed to save password in SSM, cause : ${err}`);
            } else {
              console.log(`Written secret to ${event.ResourceProperties.path}`);
              successCallBack();
            }
          });
        }
      });
  }

  function applyIfSecretValueSet(
    path: string,
    applyToSecret: (path: string) => void,
    applyToMissingSecret: (path: string) => void,
    errorCallBack: (cause: string) => void
  ): void {
    console.log("checking if secret already exists");
    var params: AWS.SSM.DescribeParametersRequest = {
      ParameterFilters: [
        {
          Key: "Name",
          Values: [path],
        },
      ],
    };

    ssm.describeParameters(params, function (err, data) {
      if (err) {
        errorCallBack(`Failed to describe secret, cause : ${err}`);
      } else {
        if (data.Parameters!.length == 0) {
          console.log("secret not found, running supplied callback");
          applyToMissingSecret(path);
        } else {
          console.log("secret found, running supplied callback");
          applyToSecret(path);
        }
      }
    });
  }

  function deleteSecret(
    path: string,
    errorCallBack: (cause: string) => void,
    successCallBack: () => void
  ) {
    var params = {
      Name: path,
    };
    ssm.deleteParameter(params, function (err, data) {
      if (err) {
        errorCallBack(
          `Failed to to remove secret located at ${path}, cause : ${err}`
        );
      } else {
        console.log(`Removed secret located in ${path}`);
        successCallBack();
      }
    });
  }

  console.log(`Received : ${event.RequestType}`);

  if (
    !event ||
    !event.ResourceProperties.path ||
    event.ResourceProperties.path === undefined
  ) {
    handleError(
      "No path was specified for the SSM parameter the secret will be stored in. Cannot continue."
    );
  }

  const path = event.ResourceProperties.path;
  const respectInitialValue =
    event.ResourceProperties.respectInitialValue || "false";
  const includeSpaces = event.ResourceProperties.includeSpaces || false;
  const secretLength = event.ResourceProperties.secretLength || 40;

  console.log(`path : ${path}`);
  console.log(`respectInitialValue : ${respectInitialValue}`);
  console.log(`includeSpaces : ${includeSpaces}`);
  console.log(`secretLength : ${secretLength}`);

  try {
    if (event.RequestType === "Create") {
      if (respectInitialValue === "false") {
        setSecretValue(path, errorCallback, successCallback);
      } else if (respectInitialValue === "true") {
        var secretSetCallback = (path: string): void => {
          handleSuccess();
        };

        var missingSecretCallback = (path: string): void => {
          setSecretValue(path, errorCallback, successCallback);
        };

        applyIfSecretValueSet(
          path,
          secretSetCallback,
          missingSecretCallback,
          errorCallback
        );
      }
    } else if (event.RequestType === "Delete") {
      var deleteSetCallback = (path: string): void => {
        deleteSecret(path, errorCallback, successCallback);
      };

      var deleteMissingCallback = (path: string): void => {
        handleSuccess();
      };

      applyIfSecretValueSet(
        path,
        deleteSetCallback,
        deleteMissingCallback,
        errorCallback
      );
    } else {
      // Updates are risky as we can cascade regeneration of secrets when the lambda gets updates etc so safer to not to do anything.
      handleSuccess();
    }
  } catch (e) {
    handleError(e);
  }
};
