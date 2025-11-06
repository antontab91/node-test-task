export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
} as const;

export const HANG_PROBABILITY = 0.1 as const;
export const ERROR_PROBABILITY = 0.2 as const;

export const HOST = '127.0.0.1';
export const PORT = 3000;

export const CLIENT_TIMEOUT_MS = 1000;
export const MAX_RETRIES = 2;
