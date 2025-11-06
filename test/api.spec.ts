import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer } from '../src/server.js';
import { request, requestSession } from '../src/api.js';

describe('client chaining & sessions', () => {
    beforeAll(() => startServer(3000));
    afterAll(async () => {
        await stopServer();
    });

    it('chains without await when result not needed + session isolation', async () => {
        request.auth = 1;
        request('POST', '/pet', { name: 'cat' });
        const dog = await request('POST', '/pet', { name: 'dog' });

        const otherPet = await requestSession(() => {
            request.auth = 2;
            return request('POST', '/pet', { name: 'jaguar' });
        });

        const myPets = await request('GET', '/pets');
        expect(myPets.map((p: any) => p.name)).toEqual(['cat', 'dog']);
        expect(myPets.map((p: any) => p.name)).not.toContain(otherPet.name);

        const jag2 = await requestSession(() => {
            request.auth = 2;
            return request('GET', `/pets/${otherPet.id}`);
        });
        expect(jag2.name).toBe('jaguar');
        expect(dog.name).toBe('dog');
    });
});
