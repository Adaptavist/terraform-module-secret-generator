import { Context } from 'aws-lambda';
import { FAILED, send, SUCCESS } from './cfnResponse';
import {
    DeleteParameterCommand, GetParameterCommand, GetParameterCommandInput, GetParameterCommandOutput, ParameterNotFound,
    PutParameterCommand,
    PutParameterCommandInput,
    PutParameterCommandOutput,
    SSMClient
} from '@aws-sdk/client-ssm';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { GetRandomPasswordCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const ssmClient = new SSMClient({});
const sts = new STSClient({});

export const handler = async (
    event: any,
    context: Context
) => {
    console.log(`Received : ${event.RequestType}`);

    if (!event || !event.ResourceProperties.path) {
        return handleError(event, context, { message: 'No path was specified for the SSM parameter the secret will be stored in. Cannot continue.' }, 'no-path');
    }

    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account;

    const path = event.ResourceProperties.path;
    const respectInitialValue = toBoolean(event.ResourceProperties.respectInitialValue);
    const includeSpaces = toBoolean(event.ResourceProperties.includeSpaces);
    const secretLength = event.ResourceProperties.secretLength || 40;

    console.log(`path: ${path}, respectInitialValue: ${respectInitialValue}, includeSpaces: ${includeSpaces}, secretLength: ${secretLength}`);

    const arn = `arn:aws:ssm:${process.env.AWS_REGION}:${accountId}:parameter/${path}`;

    try {
        if (event.RequestType === 'Create') {
            if (respectInitialValue) {
                const resp = await getParameter(path, ssmClient);
                if (resp.Parameter !== undefined) {
                    // param already exists, dont overwrite
                    return handleSuccess(event, context, {}, arn);
                }
            }
            return createSetNewSecret(includeSpaces, secretLength, path, event, context, arn);
        }

        if (event.RequestType === 'Delete') {
            const resp = await getParameter(path, ssmClient);
            if (resp.Parameter === undefined) {
                // nothing to delete
                return handleSuccess(event, context, {}, arn);
            }

            try {
                const result = await deleteSecret(path, ssmClient);
                return handleSuccess(event, context, { result }, arn);
            } catch (error) {
                return handleError(event, context, { error }, arn);
            }
        }

        if (event.RequestType === 'Update') {
            const oldDetails = event.OldResourceProperties;
            const changeLength = oldDetails.secretLength !== secretLength;
            const changeSpaces = oldDetails.includeSpaces !== includeSpaces;
            const changePath = oldDetails.path !== path;

            if (changePath) {
                const newParamResp = await getParameter(path, ssmClient);
                if (newParamResp.Parameter === undefined) {
                    // create new param
                    // set a brand new secret if we fail to get the old value OR we are asked to change the length/spaces config of the secret
                    const oldParamResp = await getParameter(oldDetails.path, ssmClient);
                    if (changeLength || changeSpaces || oldParamResp.Parameter === undefined) {
                        return createSetNewSecret(includeSpaces, secretLength, path, event, context, arn);
                    }
                    const result = await setSecretValue(path, ssmClient, oldParamResp.Parameter.Value!);
                    return handleSuccess(event, context, { result }, arn);
                } else {
                    if (!respectInitialValue) {
                        // update new already existing param
                        // set a brand new secret if we fail to get the old value OR we are asked to change the length/spaces config of the secret
                        const oldParamResp = await getParameter(oldDetails.path, ssmClient);
                        if (changeLength || changeSpaces || oldParamResp.Parameter === undefined) {
                            return createSetNewSecret(includeSpaces, secretLength, path, event, context, arn);
                        }
                        const result = await setSecretValue(path, ssmClient, oldParamResp.Parameter.Value!);
                        return handleSuccess(event, context, { result }, arn);
                    }
                }
            } else {
                // the SSM param path is the same
                // only update the value if the length/space config of the secret have changed AND we are not asked to respect the initial value
                if (!respectInitialValue && (changeLength || changeSpaces)) {
                    return createSetNewSecret(includeSpaces, secretLength, path, event, context, arn);
                }
            }
        }

        // do nothing
        return handleSuccess(event, context, {}, arn);
    } catch (error) {
        console.log(error);
        return handleError(event, context, { error }, arn);
    }
};

const createSetNewSecret = async (includeSpaces: boolean, secretLength: number, path: string, event: any, context: Context, arn: string) => {
    const secret = await getRandomSecret(includeSpaces, secretLength);
    try {
        const result = await setSecretValue(path, ssmClient, secret);
        return handleSuccess(event, context, { result }, arn);
    } catch (error) {
        return handleError(event, context, { error }, arn);
    }
};

const getRandomSecret = async (includeSpaces: boolean, secretLength: number): Promise<string> => {
    const client = new SecretsManagerClient({});

    return client.send(new GetRandomPasswordCommand({
        IncludeSpace: includeSpaces,
        PasswordLength: secretLength,
        RequireEachIncludedType: true,
        ExcludePunctuation: true
    })).then(resp => {
        if (resp.RandomPassword) {
            return resp.RandomPassword;
        }
        throw new Error('No password returned');
    });
};

const setSecretValue = async (
    path: string,
    client: SSMClient,
    secret: string
): Promise<PutParameterCommandOutput> => {
    const params: PutParameterCommandInput = {
        Name: path,
        Value: secret,
        Overwrite: true,
        Type: 'SecureString'
    };

    return client.send(new PutParameterCommand(params));
};

const deleteSecret = async (
    path: string,
    client: SSMClient
): Promise<boolean> => {
    const params = {
        Name: path
    };
    return client.send(new DeleteParameterCommand(params))
        .then(() => true)
        .catch(error => {
            if (error instanceof ParameterNotFound) {
                return true;
            }
            throw error;
        });
};

const getParameter = async (path: string, client: SSMClient): Promise<GetParameterCommandOutput> => {
    const params: GetParameterCommandInput = {
        Name: path,
        WithDecryption: true
    };

    return client.send(new GetParameterCommand(params))
        .catch(error => {
            if (error instanceof ParameterNotFound) {
                return {
                    $metadata: {}
                };
            }
            throw error;
        });
};

const handleError = async (event: any, context: Context, cause: object, physicalResourceId: string) => {
    return send(event, context, FAILED, cause, physicalResourceId);
};

const handleSuccess = async (event: any, context: Context, data: object, physicalResourceId: string) => {
    return send(event, context, SUCCESS, data, physicalResourceId);
};

/**
 * Returns true if the input is 'true', true, '1' or 1
 * @param input
 */
const toBoolean = (input: any) => input === 'true' || input === '1' || input === true || input === 1;
