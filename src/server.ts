import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import debug from 'debug';

import {
    HTTP_STATUS,
    HANG_PROBABILITY,
    ERROR_PROBABILITY,
} from './constants.js';
import { Pet, SendJsonArgs, SendTextArgs } from './types.js';

const log = debug('server');
const usersById = new Map<number, Pet[]>();
let nextPetId = 1;

function sendJson({
    response,
    data,
    code = HTTP_STATUS.OK,
}: SendJsonArgs): void {
    response.statusCode = code;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(data));
}

function sendText({
    response,
    text,
    code = HTTP_STATUS.BAD_REQUEST,
}: SendTextArgs): void {
    response.statusCode = code;
    response.end(text);
}

function notFound(response: ServerResponse): void {
    sendText({ response, text: 'Not found', code: HTTP_STATUS.NOT_FOUND });
}

function badRequest(response: ServerResponse, text = 'Bad JSON'): void {
    sendText({ response, text, code: HTTP_STATUS.BAD_REQUEST });
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

function getUserId(request: IncomingMessage): number | null {
    const h = request.headers['authorization'];
    if (!h || !h.startsWith('Bearer ')) return null;
    const id = Number(h.slice(7).trim());
    return Number.isFinite(id) ? id : null;
}

async function handlePetsRoute(
    req: IncomingMessage,
    res: ServerResponse,
    userId: number
): Promise<void> {
    if (!usersById.has(userId)) usersById.set(userId, []);
    const pets = usersById.get(userId)!;

    const { pathname } = new URL(req.url!, 'http://localhost');
    const method = req.method!;

    if (method === 'GET' && pathname === '/pets') {
        sendJson({ response: res, data: pets });
        return;
    }

    if (method === 'GET' && pathname.startsWith('/pets/')) {
        const id = Number(pathname.split('/')[2]);
        if (!Number.isFinite(id)) return badRequest(res, 'Invalid pet id');
        const pet = pets.find((p) => p.id === id);
        if (!pet) return notFound(res);
        sendJson({ response: res, data: pet });
        return;
    }

    if (method === 'POST' && pathname === '/pet') {
        try {
            const body = await readJsonBody<{ name: string }>(req);
            const pet: Pet = {
                id: nextPetId++,
                name: String(body?.name ?? ''),
            };
            pets.push(pet);
            sendJson({ response: res, data: pet, code: HTTP_STATUS.CREATED });
            return;
        } catch {
            return badRequest(res);
        }
    }

    notFound(res);
}

const server = createServer(async (req, res) => {
    // нестабильность
    if (Math.random() < ERROR_PROBABILITY) {
        res.statusCode = HTTP_STATUS.INTERNAL_ERROR;
        res.end('Random server error');
        return;
    }
    if (Math.random() < HANG_PROBABILITY) {
        await new Promise(() => {}); // зависание без ответа
    }

    if (!req.url || !req.method) {
        res.end();
        return;
    }

    const userId = getUserId(req);
    if (userId === null) {
        sendText({
            response: res,
            text: 'Unauthorized',
            code: HTTP_STATUS.UNAUTHORIZED,
        });
        return;
    }

    log('%s %s (user %d)', req.method, req.url, userId);

    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname.startsWith('/pets') || pathname === '/pet') {
        await handlePetsRoute(req, res, userId);
        return;
    }

    notFound(res);
});

export function startServer(port = 3000) {
    return server.listen(port, () => log(`listening on :${port}`));
}

export function stopServer(): Promise<void> {
    return new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
    );
}
