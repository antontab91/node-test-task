import { startServer } from './server.js';
import { request, requestSession } from './api.js';

startServer(3000);

(async () => {
    request.auth = 1;
    await request('POST', '/pet', { name: 'cat' });
    const dog = await request('POST', '/pet', { name: 'dog' });

    const otherPet = await requestSession(async () => {
        request.auth = 2;
        return request('POST', '/pet', { name: 'jaguar' });
    });

    const myPets = await request('GET', '/pets');
    console.log('user1 pets:', myPets);
    console.log('other pet:', otherPet);

    const jag2 = await requestSession(async () => {
        request.auth = 2;
        return request('GET', '/pets/' + otherPet.id);
    });
    console.log('user2 jaguar by id:', jag2);
})();
