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
      Reason: `See the details in CloudWatch Log Group ${context.logGroupName} Log Stream ${context.logStreamName}; response ${JSON.stringify(responseData)}`,
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
    return handleError(event, context, {message: "No path was specified for the SSM parameter the secret will be stored in. Cannot continue."});
  }
  const path = event.ResourceProperties.path;
  const respectInitialValue = event.ResourceProperties.respectInitialValue || "false";
  const includeSpaces = event.ResourceProperties.includeSpaces || false;
  const secretLength = event.ResourceProperties.secretLength || 40;
  const regions = event.ResourceProperties.regions;
  const ssmClients = !regions ? [new AWS.SSM()] : regions.map((region) => {
    return new AWS.SSM({region});
  });
  console.log(`path : ${path}`);
  console.log(`respectInitialValue : ${respectInitialValue}`);
  console.log(`includeSpaces : ${includeSpaces}`);
  console.log(`secretLength : ${secretLength}`);
  try {
    const secret = await getRandomSecret(includeSpaces, secretLength);
    let result;
    if (event.RequestType === "Create") {
      if (respectInitialValue === "true") {
        const params = await describeParameter(path, ssmClients);
        if (params.length && params.length !== regions.length) {
          throw new Error(`Parameters not found in all regions ${regions} with respectInitialValue ${respectInitialValue}`);
        } else if (params.length && params.length === regions.length) {
          return handleSuccess(event, context, {params});
        }
      }
      result = await setSecretValue(path, ssmClients, secret);
    }
    if (event.RequestType === "Delete") {
      const params = await describeParameter(path, ssmClients);
      if (!params || !params.length || params.length !== (regions || []).length && respectInitialValue) {
        return handleSuccess(event, context, {params});
      }
      result = await deleteSecret(path, ssmClients);
    }
    return handleSuccess(event, context, {result});
  } catch (error) {
    console.log(error);
    return handleError(event, context, {error});
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
    return await Promise.all(promises);
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
    return await Promise.all(promises);
  } catch (error) {
    console.warn(error);
    if (error.code === "ParameterNotFound") {
      return [];
    }
    throw error;
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
    return await Promise.all(promises).then((params) => {
      return params.filter((param) => param.Parameters && param.Parameters.length);
    });
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to to describe secret located at ${path}, cause : ${error}`);
  }
};
var handleError = async (event, context, cause) => {
  return send(event, context, FAILED, cause);
};
var handleSuccess = async (event, context, data) => {
  return send(event, context, SUCCESS, data);
};
