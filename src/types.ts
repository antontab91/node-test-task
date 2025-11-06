import type { ServerResponse } from 'node:http';
import { HTTP_STATUS } from './constants.js';

export type Method = 'GET' | 'POST';
export type Body = Record<string, unknown> | undefined;

export type Context = { auth: number | undefined; chain: Promise<void> };

export type RetryError = Error & { retry?: boolean };

export type Pet = {
    id: number;
    name: string;
};

type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export type SendTextArgs = {
    response: ServerResponse;
    text: string;
    code?: HttpStatusCode;
};

export type SendJsonArgs = {
    response: ServerResponse;
    data: unknown;
    code?: HttpStatusCode;
};

export type RequestWithAuth = {
    (method: 'GET', path: '/pets'): Promise<Pet[]>;
    (method: 'GET', path: `/pets/${number}`): Promise<Pet>;
    (method: 'POST', path: '/pet', body: { name: string }): Promise<Pet>;
    (method: Method, path: string, body?: Body): Promise<unknown>;

    auth: number | undefined;
};
