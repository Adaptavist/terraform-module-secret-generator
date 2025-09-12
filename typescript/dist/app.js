"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// app.ts
var app_exports = {};
__export(app_exports, {
  handler: () => handler,
  toNumber: () => toNumber
});
module.exports = __toCommonJS(app_exports);

// cfnResponse/index.ts
var SUCCESS = "SUCCESS";
var FAILED = "FAILED";
var send = async (event, responseStatus, responseData, physicalResourceId, reason) => {
  return new Promise((resolve, reject) => {
    const responseBody = JSON.stringify({
      Status: responseStatus,
      Reason: reason,
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      NoEcho: false,
      Data: responseData
    });
    console.log("Response body:\n", responseBody);
    const https = require("https");
    const parsedUrl = URL.parse(event.ResponseURL);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "PUT",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-length": responseBody.length
      }
    };
    const request = https.request(options, function(response) {
      console.log(`Status: ${response.statusCode} ${response.statusMessage}`);
      resolve();
    });
    request.on("error", function(error) {
      console.error("send(..) failed executing https.request(..): ", error);
      reject(error);
    });
    request.write(responseBody);
    request.end();
  });
};

// app.ts
var import_client_ssm = require("@aws-sdk/client-ssm");
var import_client_sts = require("@aws-sdk/client-sts");
var import_client_secrets_manager = require("@aws-sdk/client-secrets-manager");
var ssmClient = new import_client_ssm.SSMClient({});
var sts = new import_client_sts.STSClient({});
var secretsManager = new import_client_secrets_manager.SecretsManagerClient({});
var handler = async (event, context) => {
  console.log(`Received : ${event.RequestType}`);
  if (!event || !event.ResourceProperties.path) {
    return handleError(event, new Error("No path was specified for the SSM parameter the secret will be stored in."), "no-path");
  }
  const identity = await sts.send(new import_client_sts.GetCallerIdentityCommand({}));
  const accountId = identity.Account;
  const path = event.ResourceProperties.path;
  const respectInitialValue = toBoolean(event.ResourceProperties.respectInitialValue);
  const includeSpaces = toBoolean(event.ResourceProperties.includeSpaces);
  const secretLength = toNumber(event.ResourceProperties.secretLength);
  console.log(`path: ${path}, respectInitialValue: ${respectInitialValue}, includeSpaces: ${includeSpaces}, secretLength: ${secretLength}`);
  const arn = `arn:aws:ssm:${process.env.AWS_REGION}:${accountId}:parameter${path.startsWith("/") ? path : "/" + path}`;
  try {
    if (event.RequestType === "Create") {
      if (respectInitialValue) {
        const resp = await getParameter(path);
        if (resp.Parameter !== void 0) {
          return handleSuccess(event, { action: "none", description: "Param exists and respectInitialValue set" }, arn);
        }
      }
      return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
    }
    if (event.RequestType === "Delete") {
      const resp = await getParameter(path);
      if (resp.Parameter === void 0) {
        return handleSuccess(event, { action: "none", description: "Param doesn't exist" }, arn);
      }
      try {
        const result = await deleteSecret(path);
        return handleSuccess(event, { action: "delete", success: result }, arn);
      } catch (error) {
        console.error(error);
        return handleError(event, error instanceof Error ? error : new Error("Failed to delete parameter"), arn);
      }
    }
    if (event.RequestType === "Update") {
      const oldDetails = event.OldResourceProperties;
      const changeLength = toNumber(oldDetails.secretLength) !== secretLength;
      const changeSpaces = toBoolean(oldDetails.includeSpaces) !== includeSpaces;
      const changePath = oldDetails.path !== path;
      if (changePath) {
        const newParamResp = await getParameter(path);
        if (newParamResp.Parameter === void 0) {
          const oldParamResp = await getParameter(oldDetails.path);
          if (changeLength || changeSpaces || oldParamResp.Parameter === void 0) {
            return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
          }
          const result = await setSecretValue(path, oldParamResp.Parameter.Value);
          return handleSuccess(event, { action: "put", version: result.Version }, arn);
        } else {
          if (!respectInitialValue) {
            const oldParamResp = await getParameter(oldDetails.path);
            if (changeLength || changeSpaces || oldParamResp.Parameter === void 0) {
              return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
            }
            const result = await setSecretValue(path, oldParamResp.Parameter.Value);
            return handleSuccess(event, { action: "put", version: result.Version }, arn);
          }
        }
      } else {
        if (!respectInitialValue && (changeLength || changeSpaces)) {
          return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
        }
      }
    }
    return handleSuccess(event, { action: "none", description: "No matching action" }, arn);
  } catch (error) {
    console.log(error);
    return handleError(event, error instanceof Error ? error : new Error("Failed to process Cloudformation event"), arn);
  }
};
var createSetNewSecret = async (includeSpaces, secretLength, path, event, arn) => {
  const secret = await getRandomSecret(includeSpaces, secretLength);
  try {
    const result = await setSecretValue(path, secret);
    return handleSuccess(event, { version: result.Version, action: "put" }, arn);
  } catch (error) {
    return handleError(event, error instanceof Error ? error : new Error("Set parameter failed"), arn);
  }
};
var getRandomSecret = async (includeSpaces, secretLength) => {
  return secretsManager.send(new import_client_secrets_manager.GetRandomPasswordCommand({
    IncludeSpace: includeSpaces,
    PasswordLength: secretLength,
    RequireEachIncludedType: true,
    ExcludePunctuation: true
  })).then((resp) => {
    if (resp.RandomPassword) {
      return resp.RandomPassword;
    }
    throw new Error("No password returned");
  });
};
var setSecretValue = async (path, secret) => {
  const params = {
    Name: path,
    Value: secret,
    Overwrite: true,
    Type: "SecureString"
  };
  return ssmClient.send(new import_client_ssm.PutParameterCommand(params));
};
var deleteSecret = async (path) => {
  const params = {
    Name: path
  };
  return ssmClient.send(new import_client_ssm.DeleteParameterCommand(params)).then(() => true).catch((error) => {
    if (error instanceof import_client_ssm.ParameterNotFound) {
      return true;
    }
    throw error;
  });
};
var getParameter = async (path) => {
  const params = {
    Name: path,
    WithDecryption: true
  };
  return ssmClient.send(new import_client_ssm.GetParameterCommand(params)).catch((error) => {
    if (error instanceof import_client_ssm.ParameterNotFound) {
      return {
        $metadata: {}
      };
    }
    throw error;
  });
};
var handleError = async (event, cause, physicalResourceId) => {
  return send(event, FAILED, {}, physicalResourceId, cause.message);
};
var handleSuccess = async (event, data, physicalResourceId) => {
  return send(event, SUCCESS, data, physicalResourceId);
};
var toBoolean = (input) => input === "true" || input === "1" || input === true || input === 1;
var MIN_LENGTH = 1;
var MAX_LENGTH = 4e3;
var DEFAULT_LENGTH = 40;
var toNumber = (input) => {
  if (Number.isInteger(input)) {
    return Math.max(MIN_LENGTH, Math.min(input, MAX_LENGTH));
  }
  if (typeof input !== "string") {
    return DEFAULT_LENGTH;
  }
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_LENGTH;
  }
  return Math.max(MIN_LENGTH, Math.min(parsed, MAX_LENGTH));
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler,
  toNumber
});
