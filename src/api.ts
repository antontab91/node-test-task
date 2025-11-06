import http from 'node:http';
import { setTimeout as setSleepTimeout } from 'timers/promises';
import { AsyncLocalStorage } from 'node:async_hooks';

import { HOST, CLIENT_TIMEOUT_MS, MAX_RETRIES, getPort } from './constants.js';
import { logCore, logHttp } from './logger.js';
import { Method, Body, Context, RetryError, RequestWithAuth } from './types.js';

const asyncStorage = new AsyncLocalStorage<Context>();
const defaultContext: Context = { auth: undefined, chain: Promise.resolve() };

function getCurrentContext(): Context {
    return asyncStorage.getStore() ?? defaultContext;
}

function createTimeoutPromise<T>(
    sourcePromise: Promise<T>,
    timeoutMilliseconds: number
): Promise<T> {
    return Promise.race([
        sourcePromise,
        new Promise<T>((_, reject) => {
            const timerId = setTimeout(
                () => reject(new Error('Timeout')),
                timeoutMilliseconds
            );
            sourcePromise.finally(() => clearTimeout(timerId));
        }),
    ]);
}

function enqueueTaskForContext<ResultType>(
    taskExecutor: () => Promise<ResultType>
): Promise<ResultType> {
    const context = getCurrentContext();
    const nextTaskPromise = context.chain
        .catch(() => null)
        .then(() => taskExecutor());
    context.chain = nextTaskPromise
        .then(() => undefined)
        .catch(() => undefined);
    return nextTaskPromise;
}

async function performHttpRequest(
    method: Method,
    path: string,
    body?: Body
): Promise<unknown> {
    const { auth } = getCurrentContext();
    const port = getPort();

    let attemptNumber = 1;
    while (true) {
        try {
            const requestPromise = new Promise<string>((resolve, reject) => {
                const request = http.request(
                    {
                        host: HOST,
                        port,
                        method,
                        path,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(auth
                                ? { Authorization: `Bearer ${auth}` }
                                : {}),
                        },
                    },
                    (response) => {
                        const chunks: Buffer[] = [];
                        response.on('data', (c) => chunks.push(c as Buffer));
                        response.on('end', () => {
                            const text = Buffer.concat(chunks).toString('utf8');
                            const status = response.statusCode ?? 0;

                            if (status === 500 || status === 401) {
                                const err: RetryError = new Error(
                                    `HTTP ${status}: ${text}`
                                );
                                err.retry = true;
                                reject(err);
                                return;
                            }

                            if (status >= 200 && status < 300) {
                                resolve(text);
                            } else {
                                reject(new Error(`HTTP ${status}: ${text}`));
                            }
                        });
                    }
                );

                request.on('error', reject);
                if (body && method === 'POST')
                    request.write(JSON.stringify(body));
                request.end();
            });

            const responseText = await createTimeoutPromise(
                requestPromise,
                CLIENT_TIMEOUT_MS
            );
            try {
                return JSON.parse(responseText);
            } catch {
                return responseText;
            }
        } catch (errorInstance) {
            const err = errorInstance as RetryError;
            const shouldRetry = err.message === 'Timeout' || err.retry === true;

            logHttp(
                'Attempt %d failed (%s), retryable=%s',
                attemptNumber,
                err.message,
                String(shouldRetry)
            );

            if (shouldRetry && attemptNumber <= MAX_RETRIES) {
                await setSleepTimeout(150 * attemptNumber);
                attemptNumber += 1;
                continue;
            }
            throw err;
        }
    }
}

export const request: RequestWithAuth = ((
    method: Method,
    path: string,
    body?: Body
) => {
    logCore('Enqueue %s %s', method, path);
    return enqueueTaskForContext(() => performHttpRequest(method, path, body));
}) as RequestWithAuth;

Object.defineProperty(request, 'auth', {
    get() {
        return getCurrentContext().auth;
    },
    set(newAuth: number | undefined) {
        const context = getCurrentContext();
        context.auth = newAuth;
    },
    configurable: false,
});

export async function requestSession<T>(
    sessionExecutor: () => T | Promise<T>
): Promise<T> {
    const isolatedContext: Context = {
        auth: getCurrentContext().auth,
        chain: Promise.resolve(),
    };

    return new Promise<T>((resolve, reject) => {
        asyncStorage.run(isolatedContext, () => {
            Promise.resolve(sessionExecutor()).then(resolve, reject);
        });
    });
}
