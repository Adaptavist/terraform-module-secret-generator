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
const secretsManager = new SecretsManagerClient({});

export const handler = async (
    event: any,
    context: Context
) => {
    console.log(`Received : ${event.RequestType}`);

    if (!event || !event.ResourceProperties.path) {
        return handleError(event, new Error('No path was specified for the SSM parameter the secret will be stored in.'), 'no-path');
    }

    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account;

    const path = event.ResourceProperties.path;
    const respectInitialValue = toBoolean(event.ResourceProperties.respectInitialValue);
    const includeSpaces = toBoolean(event.ResourceProperties.includeSpaces);
    const secretLength = toNumber(event.ResourceProperties.secretLength);

    console.log(`path: ${path}, respectInitialValue: ${respectInitialValue}, includeSpaces: ${includeSpaces}, secretLength: ${secretLength}`);

    const arn = `arn:aws:ssm:${process.env.AWS_REGION}:${accountId}:parameter${path.startsWith('/') ? path : '/' + path}`;

    try {
        if (event.RequestType === 'Create') {
            if (respectInitialValue) {
                const resp = await getParameter(path);
                if (resp.Parameter !== undefined) {
                    // param already exists, dont overwrite
                    return handleSuccess(event, { action: 'none', description: 'Param exists and respectInitialValue set' }, arn);
                }
            }
            return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
        }

        if (event.RequestType === 'Delete') {
            const resp = await getParameter(path);
            if (resp.Parameter === undefined) {
                // nothing to delete
                return handleSuccess(event, { action: 'none', description: "Param doesn't exist" }, arn);
            }

            try {
                const result = await deleteSecret(path);
                return handleSuccess(event, { action: 'delete', success: result }, arn);
            } catch (error) {
                console.error(error);
                return handleError(event, error instanceof Error ? error : new Error('Failed to delete parameter'), arn);
            }
        }

        if (event.RequestType === 'Update') {
            const oldDetails = event.OldResourceProperties;
            const changeLength = toNumber(oldDetails.secretLength) !== secretLength;
            const changeSpaces = toBoolean(oldDetails.includeSpaces) !== includeSpaces;
            const changePath = oldDetails.path !== path;

            if (changePath) {
                const newParamResp = await getParameter(path);
                if (newParamResp.Parameter === undefined) {
                    // create new param
                    // set a brand new secret if we fail to get the old value OR we are asked to change the length/spaces config of the secret
                    const oldParamResp = await getParameter(oldDetails.path);
                    if (changeLength || changeSpaces || oldParamResp.Parameter === undefined) {
                        return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
                    }
                    const result = await setSecretValue(path, oldParamResp.Parameter.Value!);
                    return handleSuccess(event, { action: 'put', version: result.Version }, arn);
                } else {
                    if (!respectInitialValue) {
                        // update new already existing param
                        // set a brand new secret if we fail to get the old value OR we are asked to change the length/spaces config of the secret
                        const oldParamResp = await getParameter(oldDetails.path);
                        if (changeLength || changeSpaces || oldParamResp.Parameter === undefined) {
                            return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
                        }
                        const result = await setSecretValue(path, oldParamResp.Parameter.Value!);
                        return handleSuccess(event, { action: 'put', version: result.Version }, arn);
                    }
                }
            } else {
                // the SSM param path is the same
                // only update the value if the length/space config of the secret have changed AND we are not asked to respect the initial value
                if (!respectInitialValue && (changeLength || changeSpaces)) {
                    return createSetNewSecret(includeSpaces, secretLength, path, event, arn);
                }
            }
        }

        // do nothing
        return handleSuccess(event, { action: 'none', description: 'No matching action' }, arn);
    } catch (error) {
        console.log(error);
        return handleError(event, error instanceof Error ? error : new Error('Failed to process Cloudformation event'), arn);
    }
};

const createSetNewSecret = async (includeSpaces: boolean, secretLength: number, path: string, event: any, arn: string) => {
    const secret = await getRandomSecret(includeSpaces, secretLength);
    try {
        const result = await setSecretValue(path, secret);
        return handleSuccess(event, { version: result.Version, action: 'put' }, arn);
    } catch (error) {
        return handleError(event, error instanceof Error ? error : new Error('Set parameter failed'), arn);
    }
};

const getRandomSecret = async (includeSpaces: boolean, secretLength: number): Promise<string> => {
    return secretsManager.send(new GetRandomPasswordCommand({
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
    secret: string
): Promise<PutParameterCommandOutput> => {
    const params: PutParameterCommandInput = {
        Name: path,
        Value: secret,
        Overwrite: true,
        Type: 'SecureString'
    };

    return ssmClient.send(new PutParameterCommand(params));
};

const deleteSecret = async (
    path: string
): Promise<boolean> => {
    const params = {
        Name: path
    };
    return ssmClient.send(new DeleteParameterCommand(params))
        .then(() => true)
        .catch(error => {
            if (error instanceof ParameterNotFound) {
                return true;
            }
            throw error;
        });
};

const getParameter = async (path: string): Promise<GetParameterCommandOutput> => {
    const params: GetParameterCommandInput = {
        Name: path,
        WithDecryption: true
    };

    return ssmClient.send(new GetParameterCommand(params))
        .catch(error => {
            if (error instanceof ParameterNotFound) {
                return {
                    $metadata: {}
                };
            }
            throw error;
        });
};

const handleError = async (event: any, cause: Error, physicalResourceId: string) => {
    return send(event, FAILED, {}, physicalResourceId, cause.message);
};

const handleSuccess = async (event: any, data: object, physicalResourceId: string) => {
    return send(event, SUCCESS, data, physicalResourceId);
};

/**
 * Returns true if the input is 'true', true, '1' or 1
 * @param input
 */
const toBoolean = (input: any) => input === 'true' || input === '1' || input === true || input === 1;

const MIN_LENGTH = 1;
const MAX_LENGTH = 4000;
const DEFAULT_LENGTH = 40;
export const toNumber = (input: any) => {
    if (Number.isInteger(input)) {
        return Math.max(MIN_LENGTH, Math.min(input, MAX_LENGTH));
    }
    if (typeof input !== 'string') {
        return DEFAULT_LENGTH;
    }
    const parsed = Number.parseInt(input, 10);
    if (Number.isNaN(parsed)) {
        return DEFAULT_LENGTH;
    }
    return Math.max(MIN_LENGTH, Math.min(parsed, MAX_LENGTH));
};
