import { AWSError, SSM } from 'aws-sdk';
import { Context } from 'aws-lambda';
import * as cfnResponse from 'cfn-response';
import { GetRandomPasswordResponse } from 'aws-sdk/clients/secretsmanager';
import { DeleteParameterResult, DescribeParametersResult, PutParameterResult } from 'aws-sdk/clients/ssm';
import AWS = require('aws-sdk');

export const handler = async (
    event: any,
    context: Context
) => {
    console.log(`Received : ${event.RequestType}`);

    if (!event || !event.ResourceProperties.path) {
        return handleError(event, context, 'No path was specified for the SSM parameter the secret will be stored in. Cannot continue.');
    }

    const path = event.ResourceProperties.path;
    const respectInitialValue = event.ResourceProperties.respectInitialValue || 'false';
    const includeSpaces = event.ResourceProperties.includeSpaces || false;
    const secretLength = event.ResourceProperties.secretLength || 40;
    const regions: string[] = event.ResourceProperties.regions;
    const ssmClients: SSM[] = regions.map(region => { return new AWS.SSM({ region: region }); });

    console.log(`path : ${path}`);
    console.log(`respectInitialValue : ${respectInitialValue}`);
    console.log(`includeSpaces : ${includeSpaces}`);
    console.log(`secretLength : ${secretLength}`);

    try {
        const secret = await getRandomSecret(includeSpaces, secretLength);

        if (event.RequestType === 'Create') {
            if (respectInitialValue === 'true') {
                await describeParameter(path, ssmClients);
                return handleSuccess(event, context);
            }
            await setSecretValue(path, ssmClients, secret);
        }

        if (event.RequestType === 'Delete') {
            await describeParameter(path, ssmClients);
            await deleteSecret(path, ssmClients);
        }

        return handleSuccess(event, context);
    } catch (e) {
        return handleError(event, context, e);
    }
};

const getRandomSecret = async (includeSpaces: boolean, secretLength: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        new AWS.SecretsManager()
            .getRandomPassword({
                IncludeSpace: includeSpaces,
                PasswordLength: secretLength,
                RequireEachIncludedType: true,
                ExcludePunctuation: true
            })
            .send((err: AWSError, data: GetRandomPasswordResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data.RandomPassword!);
                }
            });
    });
};

const setSecretValue = async (
    path: string,
    ssmClients: SSM[],
    secret: string
): Promise<PutParameterResult[]> => {
    const promises: Promise<PutParameterResult>[] = [];
    ssmClients.forEach(client => {
        const params = {
            Name: path,
            Value: secret,
            Overwrite: true,
            Type: 'SecureString'
        };

        const promise = client.putParameter(params).promise();
        promises.push(promise);
    });

    return Promise.all(promises);
};

const deleteSecret = async (
    path: string,
    ssmClients: SSM[]
) : Promise<DeleteParameterResult[]> => {
    const promises: Promise<DeleteParameterResult>[] = [];
    ssmClients.forEach(client => {
        const params = {
            Name: path
        };
        const promise = client.deleteParameter(params).promise();
        promises.push(promise);
    });
    return Promise.all(promises);
};

const describeParameter = async (path: string, ssmClients: SSM[]): Promise<DescribeParametersResult[]> => {
    const promises: Promise<DeleteParameterResult>[] = [];
    ssmClients.forEach(client => {
        const params: AWS.SSM.DescribeParametersRequest = {
            ParameterFilters: [
                {
                    Key: 'Name',
                    Values: [path]
                }
            ]
        };

        const promise = client.describeParameters(params).promise();
        promises.push(promise);
    });

    return Promise.all(promises);
};

const handleError = async (event: any, context: Context, cause: string) => {
    const error = new Error(cause);
    cfnResponse.send(event, context, cfnResponse.FAILED, error);
};

const handleSuccess = async (event: any, context: Context) => {
    cfnResponse.send(event, context, cfnResponse.SUCCESS, {});
};

// , function (err, data) {
//         if (err) {
//             errorCallBack(
//                 `Failed to to remove secret located at ${path}, cause : ${err}`
//             );
//         } else {
//             console.log(`Removed secret located in ${path}`);
//             successCallBack();
//         }
//     });
// })
//

// function (err, data) {
//     if (err) {
//         errorCallBack(`Failed to describe secret, cause : ${err}`);
//     } else {
//         if (data.Parameters!.length == 0) {
//             console.log('secret not found, running supplied callback');
//             applyToMissingSecret(path);
//         } else {
//             console.log('secret found, running supplied callback');
//             applyToSecret(path);
//         }
//     }
// }
