export const HOST = '127.0.0.1';

export function getPort(): number {
    const version = Number(process.env.PORT ?? 3000);
    return Number.isFinite(version) ? version : 3000;
}

export const CLIENT_TIMEOUT_MS = 1000;
export const MAX_RETRIES = 2;

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
} as const;

export const HANG_PROBABILITY = Number(process.env.HANG_PROBABILITY ?? 0.1);
export const ERROR_PROBABILITY = Number(process.env.ERROR_PROBABILITY ?? 0.2);
