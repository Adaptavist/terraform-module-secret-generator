// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { IncomingMessage } from 'http';

type Status = 'SUCCESS' | 'FAILED';

const SUCCESS = 'SUCCESS';
const FAILED = 'FAILED';

const send = async (event: any, responseStatus: Status, responseData: any, physicalResourceId: string, reason?: string): Promise<void> => {
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

        console.log('Response body:\n', responseBody);

        const https = require('https');

        const parsedUrl = URL.parse(event.ResponseURL)!;
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname,
            method: 'PUT',
            headers: {
                'content-type': 'application/json; charset=utf-8',
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
