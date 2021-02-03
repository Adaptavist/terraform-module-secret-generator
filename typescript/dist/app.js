"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importStar(require("aws-sdk"));
const cfnResponse = __importStar(require("cfn-response"));
var ssm = new aws_sdk_1.default.SSM();
exports.handler = function (event, context, callback) {
    function handleError(cause) {
        const error = new Error(cause);
        cfnResponse.send(event, context, cfnResponse.FAILED, error);
        callback(error, null);
    }
    function handleSuccess() {
        cfnResponse.send(event, context, cfnResponse.SUCCESS, {});
        callback(null, null);
    }
    const errorCallback = (cause) => {
        handleError(cause);
    };
    const successCallback = () => {
        handleSuccess();
    };
    function setSecretValue(path, errorCallBack, successCallBack) {
        new aws_sdk_1.SecretsManager()
            .getRandomPassword({
                IncludeSpace: includeSpaces,
                PasswordLength: secretLength,
                RequireEachIncludedType: true,
                ExcludePunctuation: true
            })
            .send((err, data) => {
                if (err) {
                    errorCallBack(`Failed to generate password, cause : ${err}`);
                }
                else {
                    var params = {
                        Name: path,
                        Value: data.RandomPassword,
                        Overwrite: true,
                        Type: "SecureString",
                    };
                    ssm.putParameter(params, function (err, data) {
                        if (err) {
                            errorCallBack(`Failed to save password in SSM, cause : ${err}`);
                        }
                        else {
                            console.log(`Written secret to ${event.ResourceProperties.path}`);
                            successCallBack();
                        }
                    });
                }
            });
    }
    function applyIfSecretValueSet(path, applyToSecret, applyToMissingSecret, errorCallBack) {
        console.log("checking if secret already exists");
        var params = {
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
            }
            else {
                if (data.Parameters.length == 0) {
                    console.log("secret not found, running supplied callback");
                    applyToMissingSecret(path);
                }
                else {
                    console.log("secret found, running supplied callback");
                    applyToSecret(path);
                }
            }
        });
    }
    function deleteSecret(path, errorCallBack, successCallBack) {
        var params = {
            Name: path,
        };
        ssm.deleteParameter(params, function (err, data) {
            if (err) {
                errorCallBack(`Failed to to remove secret located at ${path}, cause : ${err}`);
            }
            else {
                console.log(`Removed secret located in ${path}`);
                successCallBack();
            }
        });
    }
    console.log(`Received : ${event.RequestType}`);
    if (!event ||
        !event.ResourceProperties.path ||
        event.ResourceProperties.path === undefined) {
        handleError("No path was specified for the SSM parameter the secret will be stored in. Cannot continue.");
    }
    const path = event.ResourceProperties.path;
    const respectInitialValue = event.ResourceProperties.respectInitialValue || "false";
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
            }
            else if (respectInitialValue === "true") {
                var secretSetCallback = (path) => {
                    handleSuccess();
                };
                var missingSecretCallback = (path) => {
                    setSecretValue(path, errorCallback, successCallback);
                };
                applyIfSecretValueSet(path, secretSetCallback, missingSecretCallback, errorCallback);
            }
        }
        else if (event.RequestType === "Delete") {
            var deleteSetCallback = (path) => {
                deleteSecret(path, errorCallback, successCallback);
            };
            var deleteMissingCallback = (path) => {
                handleSuccess();
            };
            applyIfSecretValueSet(path, deleteSetCallback, deleteMissingCallback, errorCallback);
        }
        else {
            // Updates are risky as we can cascade regeneration of secrets when the lambda gets updates etc so safer to not to do anything.
            handleSuccess();
        }
    }
    catch (e) {
        handleError(e);
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxtREFBOEM7QUFFOUMsMERBQTRDO0FBRTVDLElBQUksR0FBRyxHQUFHLElBQUksaUJBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVYLFFBQUEsT0FBTyxHQUFHLFVBQ3JCLEtBQVUsRUFDVixPQUFnQixFQUNoQixRQUFrQjtJQUVsQixTQUFTLFdBQVcsQ0FBQyxLQUFhO1FBQ2hDLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVELFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVELFNBQVMsYUFBYTtRQUNwQixXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxRCxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxNQUFNLGFBQWEsR0FBRyxDQUFDLEtBQWEsRUFBUSxFQUFFO1FBQzVDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQixDQUFDLENBQUM7SUFFRixNQUFNLGVBQWUsR0FBRyxHQUFTLEVBQUU7UUFDakMsYUFBYSxFQUFFLENBQUM7SUFDbEIsQ0FBQyxDQUFDO0lBRUYsU0FBUyxjQUFjLENBQ3JCLElBQVksRUFDWixhQUFzQyxFQUN0QyxlQUEyQjtRQUUzQixJQUFJLHdCQUFjLEVBQUU7YUFDakIsaUJBQWlCLENBQUM7WUFDakIsWUFBWSxFQUFFLGFBQWE7WUFDM0IsY0FBYyxFQUFFLFlBQVk7WUFDNUIsdUJBQXVCLEVBQUUsSUFBSTtTQUM5QixDQUFDO2FBQ0QsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFO1lBQ2xCLElBQUksR0FBRyxFQUFFO2dCQUNQLGFBQWEsQ0FBQyx3Q0FBd0MsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUM5RDtpQkFBTTtnQkFDTCxJQUFJLE1BQU0sR0FBRztvQkFDWCxJQUFJLEVBQUUsSUFBSTtvQkFDVixLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWU7b0JBQzNCLFNBQVMsRUFBRSxJQUFJO29CQUNmLElBQUksRUFBRSxjQUFjO2lCQUNyQixDQUFDO2dCQUVGLEdBQUcsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLFVBQVUsR0FBRyxFQUFFLElBQUk7b0JBQzFDLElBQUksR0FBRyxFQUFFO3dCQUNQLGFBQWEsQ0FBQywyQ0FBMkMsR0FBRyxFQUFFLENBQUMsQ0FBQztxQkFDakU7eUJBQU07d0JBQ0wsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7d0JBQ2xFLGVBQWUsRUFBRSxDQUFDO3FCQUNuQjtnQkFDSCxDQUFDLENBQUMsQ0FBQzthQUNKO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsU0FBUyxxQkFBcUIsQ0FDNUIsSUFBWSxFQUNaLGFBQXFDLEVBQ3JDLG9CQUE0QyxFQUM1QyxhQUFzQztRQUV0QyxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFDakQsSUFBSSxNQUFNLEdBQXNDO1lBQzlDLGdCQUFnQixFQUFFO2dCQUNoQjtvQkFDRSxHQUFHLEVBQUUsTUFBTTtvQkFDWCxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUM7aUJBQ2Y7YUFDRjtTQUNGLENBQUM7UUFFRixHQUFHLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLFVBQVUsR0FBRyxFQUFFLElBQUk7WUFDaEQsSUFBSSxHQUFHLEVBQUU7Z0JBQ1AsYUFBYSxDQUFDLHNDQUFzQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO2FBQzVEO2lCQUFNO2dCQUNMLElBQUksSUFBSSxDQUFDLFVBQVcsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO29CQUNoQyxPQUFPLENBQUMsR0FBRyxDQUFDLDZDQUE2QyxDQUFDLENBQUM7b0JBQzNELG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUM1QjtxQkFBTTtvQkFDTCxPQUFPLENBQUMsR0FBRyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7b0JBQ3ZELGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDckI7YUFDRjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFNBQVMsWUFBWSxDQUNuQixJQUFZLEVBQ1osYUFBc0MsRUFDdEMsZUFBMkI7UUFFM0IsSUFBSSxNQUFNLEdBQUc7WUFDWCxJQUFJLEVBQUUsSUFBSTtTQUNYLENBQUM7UUFDRixHQUFHLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJO1lBQzdDLElBQUksR0FBRyxFQUFFO2dCQUNQLGFBQWEsQ0FDWCx5Q0FBeUMsSUFBSSxhQUFhLEdBQUcsRUFBRSxDQUNoRSxDQUFDO2FBQ0g7aUJBQU07Z0JBQ0wsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDakQsZUFBZSxFQUFFLENBQUM7YUFDbkI7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFFL0MsSUFDRSxDQUFDLEtBQUs7UUFDTixDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJO1FBQzlCLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUMzQztRQUNBLFdBQVcsQ0FDVCw0RkFBNEYsQ0FDN0YsQ0FBQztLQUNIO0lBRUQsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQztJQUMzQyxNQUFNLG1CQUFtQixHQUN2QixLQUFLLENBQUMsa0JBQWtCLENBQUMsbUJBQW1CLElBQUksT0FBTyxDQUFDO0lBQzFELE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLElBQUksS0FBSyxDQUFDO0lBQ3RFLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO0lBRWpFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzlCLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLG1CQUFtQixFQUFFLENBQUMsQ0FBQztJQUM1RCxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixhQUFhLEVBQUUsQ0FBQyxDQUFDO0lBQ2hELE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLFlBQVksRUFBRSxDQUFDLENBQUM7SUFFOUMsSUFBSTtRQUNGLElBQUksS0FBSyxDQUFDLFdBQVcsS0FBSyxRQUFRLEVBQUU7WUFDbEMsSUFBSSxtQkFBbUIsS0FBSyxPQUFPLEVBQUU7Z0JBQ25DLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLGVBQWUsQ0FBQyxDQUFDO2FBQ3REO2lCQUFNLElBQUksbUJBQW1CLEtBQUssTUFBTSxFQUFFO2dCQUN6QyxJQUFJLGlCQUFpQixHQUFHLENBQUMsSUFBWSxFQUFRLEVBQUU7b0JBQzdDLGFBQWEsRUFBRSxDQUFDO2dCQUNsQixDQUFDLENBQUM7Z0JBRUYsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLElBQVksRUFBUSxFQUFFO29CQUNqRCxjQUFjLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxlQUFlLENBQUMsQ0FBQztnQkFDdkQsQ0FBQyxDQUFDO2dCQUVGLHFCQUFxQixDQUNuQixJQUFJLEVBQ0osaUJBQWlCLEVBQ2pCLHFCQUFxQixFQUNyQixhQUFhLENBQ2QsQ0FBQzthQUNIO1NBQ0Y7YUFBTSxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssUUFBUSxFQUFFO1lBQ3pDLElBQUksaUJBQWlCLEdBQUcsQ0FBQyxJQUFZLEVBQVEsRUFBRTtnQkFDN0MsWUFBWSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDckQsQ0FBQyxDQUFDO1lBRUYsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLElBQVksRUFBUSxFQUFFO2dCQUNqRCxhQUFhLEVBQUUsQ0FBQztZQUNsQixDQUFDLENBQUM7WUFFRixxQkFBcUIsQ0FDbkIsSUFBSSxFQUNKLGlCQUFpQixFQUNqQixxQkFBcUIsRUFDckIsYUFBYSxDQUNkLENBQUM7U0FDSDthQUFNO1lBQ0wsK0hBQStIO1lBQy9ILGFBQWEsRUFBRSxDQUFDO1NBQ2pCO0tBQ0Y7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNoQjtBQUNILENBQUMsQ0FBQyJ9
