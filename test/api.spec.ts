import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { startServer, stopServer } from '../src/server.js';
import { request, requestSession } from '../src/api.js';
import { AddressInfo } from 'node:net';

describe('client chaining & sessions', () => {
    beforeAll(async () => {
        const srv = startServer(0);
        const port = (srv.address() as AddressInfo).port;
        process.env.PORT = String(port);
        process.env.ERROR_PROBABILITY = '0';
        process.env.HANG_PROBABILITY = '0';
    });

    afterAll(async () => {
        await stopServer();
    });

    it('chains without await when result not needed + session isolation', async () => {
        request.auth = 1;
        void request('POST', '/pet', { name: 'cat' });
        const dog = await request('POST', '/pet', { name: 'dog' });

        const otherPet = await requestSession(async () => {
            request.auth = 2;
            return request('POST', '/pet', { name: 'jaguar' }) as Promise<any>;
        });

        const myPets = await request('GET', '/pets');
        expect(myPets.map((p: any) => p.name)).toEqual(['cat', 'dog']);
        expect(myPets.map((p: any) => p.name)).not.toContain(otherPet.name);

        const jag = await requestSession(async () => {
            request.auth = 2;
            return request('GET', `/pets/${otherPet.id}`);
        });
        expect((jag as any).name).toBe('jaguar');
    });
});
