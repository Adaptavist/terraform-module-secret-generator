var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __commonJS = (callback, module2) => () => {
  if (!module2) {
    module2 = {exports: {}};
    callback(module2.exports, module2);
  }
  return module2.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __exportStar = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  if (module2 && module2.__esModule)
    return module2;
  return __exportStar(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", {value: module2, enumerable: true})), module2);
};

// node_modules/cfn-response/index.js
var require_cfn_response = __commonJS((exports2) => {
  exports2.SUCCESS = "SUCCESS";
  exports2.FAILED = "FAILED";
  exports2.send = function(event, context, responseStatus, responseData, physicalResourceId) {
    var responseBody = JSON.stringify({
      Status: responseStatus,
      Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
      PhysicalResourceId: physicalResourceId || context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: responseData
    });
    console.log("Response body:\n", responseBody);
    var https = require("https");
    var url = require("url");
    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: "PUT",
      headers: {
        "content-type": "",
        "content-length": responseBody.length
      }
    };
    var request = https.request(options, function(response) {
      console.log("Status code: " + response.statusCode);
      console.log("Status message: " + response.statusMessage);
      context.done();
    });
    request.on("error", function(error) {
      console.log("send(..) failed executing https.request(..): " + error);
      context.done();
    });
    request.write(responseBody);
    request.end();
  };
});

// app.ts
__markAsModule(exports);
__export(exports, {
  handler: () => handler
});
var cfnResponse = __toModule(require_cfn_response());
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
  return Promise.all(promises);
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
  return Promise.all(promises);
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
  return Promise.all(promises);
};
var handleError = async (event, context, cause) => {
  const error = new Error(cause);
  cfnResponse.send(event, context, cfnResponse.FAILED, error);
};
var handleSuccess = async (event, context) => {
  cfnResponse.send(event, context, cfnResponse.SUCCESS, {});
};
