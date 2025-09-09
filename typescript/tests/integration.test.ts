import { handler, toNumber } from '../app';
import { Context } from 'aws-lambda';
import * as nock from 'nock';
import {
    DeleteParameterCommand,
    GetParameterCommand,
    ParameterNotFound,
    PutParameterCommand,
    SSMClient
} from '@aws-sdk/client-ssm';
import { v4 as uuid } from 'uuid';

const context: Context = {
    logGroupName: 'testing',
    logStreamName: 'create-test',
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'create-secret',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:123456789:us-west-2:function/create-secret',
    memoryLimitInMB: '512',
    awsRequestId: 'none',
    getRemainingTimeInMillis(): number {
        return 0;
    },
    done(error?: Error, result?: any): void {
        // do nothing
    },
    fail(error: Error | string): void {
        // do nothing
    },
    succeed(messageOrObject: any, object?: any): void {
        // do nothing
    }
};

const NEW_PARAM = `/sr/integration/test/secret/${uuid()}`;
const SHORT_PARAM = `/sr/integration/test/secret/${uuid()}`;
const OVERWRITE_PARAM = `/sr/integration/test/secret/${uuid()}`;
const RESPECT_PARAM = `/sr/integration/test/secret/${uuid()}`;
const MISSING_PARAM = `/sr/integration/test/secret/${uuid()}`;
const TO_DELETE = `/sr/integration/test/secret/${uuid()}`;
const ORIGIN_PARAM = `/sr/integration/test/secret/${uuid()}`;
const TARGET_PARAM = `/sr/integration/test/secret/${uuid()}`;
const ORIGIN_PARAM_2 = `/sr/integration/test/secret/${uuid()}`;
const TARGET_PARAM_2 = `/sr/integration/test/secret/${uuid()}`;
const ORIGIN_PARAM_3 = `/sr/integration/test/secret/${uuid()}`;
const TARGET_PARAM_3 = `/sr/integration/test/secret/${uuid()}`;
const ORIGIN_PARAM_4 = `/sr/integration/test/secret/${uuid()}`;
const TARGET_PARAM_4 = `/sr/integration/test/secret/${uuid()}`;
const ORIGIN_PARAM_5 = `/sr/integration/test/secret/${uuid()}`;
const TARGET_PARAM_5 = `/sr/integration/test/secret/${uuid()}`;
const UPDATE_PARAM = `/sr/integration/test/secret/${uuid()}`;
const UPDATE_PARAM_2 = `/sr/integration/test/secret/${uuid()}`;
const UPDATE_PARAM_3 = `/sr/integration/test/secret/${uuid()}`;
const UPDATE_PARAM_4 = `/sr/integration/test/secret/${uuid()}`;
const ssm = new SSMClient({});

const putParam = (path: string, value = 'initial') => {
    return ssm.send(new PutParameterCommand({ Name: path, Value: value, Type: 'SecureString' }));
};
const getParam = (path: string) => {
    return ssm.send(new GetParameterCommand({ Name: path, WithDecryption: true }));
};
const notExists = (path: string) => {
    return getParam(path)
        .then(_resp => {
            throw new Error(`Param ${path} already exists`);
        }, e => {
            if (e instanceof ParameterNotFound) {
                return true;
            }
            throw e;
        });
};
const exists = (path: string) => {
    return getParam(path)
        .then(_resp => {
            return true;
        }, _error => {
            return false;
        });
};

describe('Create resource', () => {

    afterAll(async () => {
        await ssm.send(new DeleteParameterCommand({ Name: NEW_PARAM }));
        await ssm.send(new DeleteParameterCommand({ Name: SHORT_PARAM }));
        await ssm.send(new DeleteParameterCommand({ Name: OVERWRITE_PARAM }));
        await ssm.send(new DeleteParameterCommand({ Name: RESPECT_PARAM }));
    });

    it('Fails with missing path', async () => {
        // given:
        const event = {
            RequestType: 'Create',
            ResponseURL: 'https://presigned.s3.aws.com/missing-path',
            ResourceProperties: {}
        };
        const scope = nock('https://presigned.s3.aws.com')
            .put('/missing-path', /No path was specified for the SSM parameter/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
    });

    it('Handles invalid numbers', () => {
        // given:
        const str = 'hello';
        const arr = [1, 2, 3, 4];
        const small = 0;
        const negative = -12345;
        const float = 12.56;
        const massive = 987654321;

        // then:
        expect(toNumber(str)).toEqual(40);
        expect(toNumber(arr)).toEqual(40);
        expect(toNumber(small)).toEqual(1);
        expect(toNumber(negative)).toEqual(1);
        expect(toNumber(float)).toEqual(40);
        expect(toNumber(massive)).toEqual(4000);
    });

    it('Creates new param using default values', async () => {
        // given:
        const event = {
            RequestType: 'Create',
            ResponseURL: 'https://presigned.s3.aws.com/create-secret',
            ResourceProperties: {
                path: NEW_PARAM
            }
        };
        await notExists(NEW_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/create-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const created = await exists(NEW_PARAM);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(created).toBeTruthy();
    });

    it('Creates new short param with spaces', async () => {
        // given:
        const event = {
            RequestType: 'Create',
            ResponseURL: 'https://presigned.s3.aws.com/create-secret',
            ResourceProperties: {
                path: SHORT_PARAM,
                includeSpaces: 'true',
                secretLength: 20
            }
        };
        await notExists(SHORT_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/create-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const created = await getParam(SHORT_PARAM);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(created.Parameter).toBeTruthy();
        expect(created.Parameter!.Value).toHaveLength(20);
    });

    it('Overwrites param value', async () => {
        // given:
        const event = {
            RequestType: 'Create',
            ResponseURL: 'https://presigned.s3.aws.com/create-secret',
            ResourceProperties: {
                path: OVERWRITE_PARAM,
            }
        };
        const created = await putParam(OVERWRITE_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/create-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(OVERWRITE_PARAM);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Version).toBeGreaterThan(created.Version!);
    });

    it('Respects initial value', async () => {
        // given:
        const event = {
            RequestType: 'Create',
            ResponseURL: 'https://presigned.s3.aws.com/create-secret',
            ResourceProperties: {
                path: RESPECT_PARAM,
                respectInitialValue: true,
            }
        };
        const created = await putParam(RESPECT_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/create-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(RESPECT_PARAM);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Version).toEqual(created.Version!);
    });
});

describe('Update resource', () => {

    afterAll(async () => {
        await ssm.send(new DeleteParameterCommand({ Name: ORIGIN_PARAM }));
        await ssm.send(new DeleteParameterCommand({ Name: TARGET_PARAM }));
        await ssm.send(new DeleteParameterCommand({ Name: TARGET_PARAM_2 }));
        await ssm.send(new DeleteParameterCommand({ Name: ORIGIN_PARAM_3 }));
        await ssm.send(new DeleteParameterCommand({ Name: TARGET_PARAM_3 }));
        await ssm.send(new DeleteParameterCommand({ Name: ORIGIN_PARAM_4 }));
        await ssm.send(new DeleteParameterCommand({ Name: TARGET_PARAM_4 }));
        await ssm.send(new DeleteParameterCommand({ Name: ORIGIN_PARAM_5 }));
        await ssm.send(new DeleteParameterCommand({ Name: TARGET_PARAM_5 }));
        await ssm.send(new DeleteParameterCommand({ Name: UPDATE_PARAM }));
        await ssm.send(new DeleteParameterCommand({ Name: UPDATE_PARAM_2 }));
        await ssm.send(new DeleteParameterCommand({ Name: UPDATE_PARAM_3 }));
        await ssm.send(new DeleteParameterCommand({ Name: UPDATE_PARAM_4 }));
    });

    it('Path changes, creates new param using original value', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: TARGET_PARAM
            },
            OldResourceProperties: {
                path: ORIGIN_PARAM
            }
        };
        await notExists(TARGET_PARAM);
        await putParam(ORIGIN_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const moved = await getParam(TARGET_PARAM);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(moved.Parameter!.Value).toEqual('initial');
        const original = await exists(ORIGIN_PARAM);
        expect(original).toBeTruthy();
    });

    it('Path changes, target already exists, update target', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: TARGET_PARAM_4
            },
            OldResourceProperties: {
                path: ORIGIN_PARAM_4
            }
        };
        await putParam(TARGET_PARAM_4, 'existing value');
        await putParam(ORIGIN_PARAM_4, 'original secret');
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(TARGET_PARAM_4);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Value).toEqual('original secret');
        const original = await exists(ORIGIN_PARAM_4);
        expect(original).toBeTruthy();
    });

    it('Path changes, target already exists, do not update target when respectInitialValue set', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: TARGET_PARAM_5,
                respectInitialValue: true,
            },
            OldResourceProperties: {
                path: ORIGIN_PARAM_5
            }
        };
        await putParam(TARGET_PARAM_5, 'existing value');
        await putParam(ORIGIN_PARAM_5, 'original secret');
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(TARGET_PARAM_5);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Value).toEqual('existing value');
        const original = await exists(ORIGIN_PARAM_5);
        expect(original).toBeTruthy();
    });

    it('Path changes, origin param doesnt exist, new param created with new value', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: TARGET_PARAM_2
            },
            OldResourceProperties: {
                path: ORIGIN_PARAM_2
            }
        };

        await notExists(TARGET_PARAM_2);
        await notExists(ORIGIN_PARAM_2);

        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const moved = await getParam(TARGET_PARAM_2);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(moved.Parameter!.Value).not.toEqual('initial');
    });

    it('Path changes and length changes, target param doesnt already exist', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: TARGET_PARAM_3,
                secretLength: 100
            },
            OldResourceProperties: {
                path: ORIGIN_PARAM_3
            }
        };

        await putParam(ORIGIN_PARAM_3);
        await notExists(TARGET_PARAM_3);

        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/) // TODO PhysicalResourceId???
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const moved = await getParam(TARGET_PARAM_3);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(moved.Parameter!.Value).not.toEqual('initial');
        expect(moved.Parameter!.Value).toHaveLength(100);
    });

    it('Length changed, path the same, respectInitialValue set, do nothing', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: UPDATE_PARAM,
                secretLength: 100,
                respectInitialValue: true
            },
            OldResourceProperties: {
                path: UPDATE_PARAM
            }
        };
        await putParam(UPDATE_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(UPDATE_PARAM);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Value).toEqual('initial');
    });

    it('Spaces changed, path the same, respectInitialValue set, do nothing', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: UPDATE_PARAM_2,
                includeSpaces: 'true',
                respectInitialValue: true
            },
            OldResourceProperties: {
                path: UPDATE_PARAM_2
            }
        };
        await putParam(UPDATE_PARAM_2);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(UPDATE_PARAM_2);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Value).toEqual('initial');
    });

    it('Length changed, path the same, updates param', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: UPDATE_PARAM_3,
                secretLength: 100
            },
            OldResourceProperties: {
                path: UPDATE_PARAM_3
            }
        };
        await putParam(UPDATE_PARAM_3);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(UPDATE_PARAM_3);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Value).not.toEqual('initial');
    });

    it('Spaces changed, path the same, updates param', async () => {
        // given:
        const event = {
            RequestType: 'Update',
            ResponseURL: 'https://presigned.s3.aws.com/update-secret',
            ResourceProperties: {
                path: UPDATE_PARAM_4,
                includeSpaces: 'true'
            },
            OldResourceProperties: {
                path: UPDATE_PARAM_4
            }
        };
        await putParam(UPDATE_PARAM_4);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/update-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const updated = await getParam(UPDATE_PARAM_4);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(updated.Parameter!.Value).not.toEqual('initial');
    });
});

describe('Delete resource', () => {
    it('Succeeds if no param to remove', async () => {
        // given:
        const event = {
            RequestType: 'Delete',
            ResponseURL: 'https://presigned.s3.aws.com/delete-secret',
            ResourceProperties: {
                path: MISSING_PARAM
            }
        };
        await notExists(MISSING_PARAM);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/delete-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
    });

    it('Succeeds if param to remove', async () => {
        // given:
        const event = {
            RequestType: 'Delete',
            ResponseURL: 'https://presigned.s3.aws.com/delete-secret',
            ResourceProperties: {
                path: TO_DELETE
            }
        };
        await putParam(TO_DELETE);
        const scope = nock('https://presigned.s3.aws.com')
            .put('/delete-secret', /Status": ?"SUCCESS/)
            .reply(200);

        // when:
        const resp = await handler(event, context);

        // then:
        const removed = await notExists(TO_DELETE);
        expect(resp).toBeUndefined();
        expect(scope.isDone()).toBeTruthy();
        expect(removed).toBeTruthy();
    });
});
