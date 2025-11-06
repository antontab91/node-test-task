import http from 'node:http';
import { setTimeout as setSleepTimeout } from 'timers/promises';
import { AsyncLocalStorage } from 'node:async_hooks';

import { HOST, PORT, CLIENT_TIMEOUT_MS, MAX_RETRIES } from './constants.js';
import { logCore, logHttp } from './logger.js';
import { Method, Body, Context, RetryError, RequestWithAuth } from './types.js';

const asyncStorage = new AsyncLocalStorage<Context>();
const defaultContext: Context = {
    auth: undefined,
    chain: Promise.resolve() as Promise<void>,
};

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
        .catch(() => null) // не ломаем очередь
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

    let attemptNumber = 1;
    while (true) {
        try {
            const requestPromise = new Promise<string>((resolve, reject) => {
                const requestObject = http.request(
                    {
                        host: HOST,
                        port: PORT,
                        method,
                        path,
                        headers: {
                            ...(method === 'POST'
                                ? { 'Content-Type': 'application/json' }
                                : {}),
                            ...(auth
                                ? { Authorization: `Bearer ${auth}` }
                                : {}),
                        },
                    },
                    (responseObject) => {
                        const responseChunks: Buffer[] = [];
                        responseObject.on('data', (chunk) =>
                            responseChunks.push(chunk as Buffer)
                        );
                        responseObject.on('end', () => {
                            const responseText =
                                Buffer.concat(responseChunks).toString('utf8');
                            const statusCode = responseObject.statusCode ?? 0;

                            if (statusCode === 500 || statusCode === 401) {
                                const err: RetryError = new Error(
                                    `HTTP ${statusCode}: ${responseText}`
                                );
                                err.retry = true;
                                reject(err);
                                return;
                            }

                            if (statusCode >= 200 && statusCode < 300) {
                                resolve(responseText);
                            } else {
                                reject(
                                    new Error(
                                        `HTTP ${statusCode}: ${responseText}`
                                    )
                                );
                            }
                        });
                    }
                );

                requestObject.on('error', reject);

                if (body && method === 'POST') {
                    requestObject.write(JSON.stringify(body));
                }

                requestObject.end();
            });

            const responseText = await createTimeoutPromise(
                requestPromise,
                CLIENT_TIMEOUT_MS
            );

            if (!responseText) return undefined;
            try {
                return JSON.parse(responseText);
            } catch {
                return responseText;
            }
        } catch (errorInstance) {
            const knownError = errorInstance as RetryError;
            const shouldRetry =
                knownError.message === 'Timeout' || knownError.retry === true;

            logHttp(
                'Attempt %d failed (%s), retryable=%s',
                attemptNumber,
                knownError.message,
                String(shouldRetry)
            );

            if (shouldRetry && attemptNumber <= MAX_RETRIES) {
                const base = 150 * attemptNumber;
                const jitter = Math.floor(Math.random() * 50);
                await setSleepTimeout(base + jitter);
                attemptNumber += 1;
                continue;
            }

            throw knownError;
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
    set(newAuthValue: number | undefined) {
        const context = getCurrentContext();
        context.auth = newAuthValue;
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
