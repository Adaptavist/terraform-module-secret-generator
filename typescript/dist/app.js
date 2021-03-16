var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};

// app.ts
__markAsModule(exports);
__export(exports, {
  handler: () => handler
});

// cfnResponse/index.ts
var SUCCESS = "SUCCESS";
var FAILED = "FAILED";
var send = async (event, context, responseStatus, responseData, error, physicalResourceId, noEcho) => {
  return new Promise((resolve, reject) => {
    const responseBody = JSON.stringify({
      Status: responseStatus,
      Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
      PhysicalResourceId: physicalResourceId || context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      NoEcho: noEcho || false,
      Data: responseData
    });
    console.log("Response body:\n", responseBody);
    const https = require("https");
    const url = require("url");
    const parsedUrl = url.parse(event.ResponseURL);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: "PUT",
      headers: {
        "content-type": "",
        "content-length": responseBody.length
      }
    };
    const request = https.request(options, function(response) {
      console.log("Status code: " + response.statusCode);
      console.log("Status message: " + response.statusMessage);
      resolve();
    });
    request.on("error", function(error2) {
      console.log("send(..) failed executing https.request(..): " + error2);
      reject(error2);
    });
    request.write(responseBody);
    request.end();
  });
};

// app.ts
var AWS = require("aws-sdk");
var handler = async (event, context) => {
  console.log(`Received : ${event.RequestType}`);
  if (!event || !event.ResourceProperties.path) {
    return handleError(event, context, "No path was specified for the SSM parameter the secret will be stored in. Cannot continue.");
  }
  const path = event.ResourceProperties.path;
  const respectInitialValue = event.ResourceProperties.respectInitialValue || "false";
  const includeSpaces = event.ResourceProperties.includeSpaces || false;
  const secretLength = event.ResourceProperties.secretLength || 40;
  const regions = event.ResourceProperties.regions;
  const ssmClients = regions.map((region) => {
    return new AWS.SSM({region});
  });
  console.log(`path : ${path}`);
  console.log(`respectInitialValue : ${respectInitialValue}`);
  console.log(`includeSpaces : ${includeSpaces}`);
  console.log(`secretLength : ${secretLength}`);
  try {
    const secret = await getRandomSecret(includeSpaces, secretLength);
    if (event.RequestType === "Create") {
      if (respectInitialValue === "true") {
        await describeParameter(path, ssmClients);
        return handleSuccess(event, context);
      }
      await setSecretValue(path, ssmClients, secret);
    }
    if (event.RequestType === "Delete") {
      await describeParameter(path, ssmClients);
      await deleteSecret(path, ssmClients);
    }
    return handleSuccess(event, context);
  } catch (e) {
    return handleError(event, context, e);
  }
};
var getRandomSecret = async (includeSpaces, secretLength) => {
  return new Promise((resolve, reject) => {
    new AWS.SecretsManager().getRandomPassword({
      IncludeSpace: includeSpaces,
      PasswordLength: secretLength,
      RequireEachIncludedType: true,
      ExcludePunctuation: true
    }).send((err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.RandomPassword);
      }
    });
  });
};
var setSecretValue = async (path, ssmClients, secret) => {
  const promises = [];
  ssmClients.forEach((client) => {
    const params = {
      Name: path,
      Value: secret,
      Overwrite: true,
      Type: "SecureString"
    };
    const promise = client.putParameter(params).promise();
    promises.push(promise);
  });
  try {
    return Promise.all(promises);
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to to create secret located at ${path}, cause : ${error}`);
  }
};
var deleteSecret = async (path, ssmClients) => {
  const promises = [];
  ssmClients.forEach((client) => {
    const params = {
      Name: path
    };
    const promise = client.deleteParameter(params).promise();
    promises.push(promise);
  });
  try {
    return Promise.all(promises);
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to to remove secret located at ${path}, cause : ${error}`);
  }
};
var describeParameter = async (path, ssmClients) => {
  const promises = [];
  ssmClients.forEach((client) => {
    const params = {
      ParameterFilters: [
        {
          Key: "Name",
          Values: [path]
        }
      ]
    };
    const promise = client.describeParameters(params).promise();
    promises.push(promise);
  });
  try {
    return Promise.all(promises).then((params) => {
      if (params.filter((param) => !param.Parameters.length).length !== 0) {
        throw new Error(`Secret not found ${path}`);
      }
      return params;
    });
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to to describe secret located at ${path}, cause : ${error}`);
  }
};
var handleError = async (event, context, cause) => {
  return send(event, context, FAILED, cause);
};
var handleSuccess = async (event, context) => {
  return send(event, context, SUCCESS, {});
};
