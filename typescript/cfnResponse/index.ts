// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Context } from 'aws-lambda';
import { IncomingMessage } from 'http';

const SUCCESS = 'SUCCESS';
const FAILED = 'FAILED';

const send = async (event: any, context: Context, responseStatus: any, responseData: any, error?: any, physicalResourceId?: any, noEcho?: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
        const responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: `See the details in CloudWatch Log Group ${context.logGroupName}/${context.logStreamName}`,
            PhysicalResourceId: physicalResourceId || context.logStreamName,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            NoEcho: noEcho || false,
            Data: responseData
        });

        console.log('Response body:\n', responseBody);

        const https = require('https');
        const url = require('url');

        const parsedUrl = url.parse(event.ResponseURL);
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.path,
            method: 'PUT',
            headers: {
                'content-type': '',
                'content-length': responseBody.length
            }
        };

        const request = https.request(options, function (response: IncomingMessage) {
            console.log('Status code: ' + response.statusCode);
            console.log('Status message: ' + response.statusMessage);
            resolve();
        });

        request.on('error', function (error: Error) {
            console.log('send(..) failed executing https.request(..): ' + error);
            reject(error);
        });

        request.write(responseBody);
        request.end();
    });
};

export { send, SUCCESS, FAILED };
