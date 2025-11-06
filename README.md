building REST API client that interacts with a simple web server

Webserver should provide a collection of pets for a user

has authentication via Bearer
has endpoints for:
GET /pets => [{ name: }, {name: }]
GET /pets/1 => { name: }
POST /pet { name: } => { id: , name: }
webserver is single JS file, EVERYTHING is memory stored (only js variables, no writing to file)
there is no actual authentication, we can use Bearer token for sessions: 'Authentication: Bearer 1' => should get pets of user 1 'Authentication: Bearer 2' => should get pets of user 2
new users are created automatically
web server can randomly throw errors (simulate unstable behavior)
web server can randonly stuck for undefinite amount of time (simulate timeout issues)
(^ this part can be easily vibecoded with AI tools)

Now you need to build a REST API client that communictaes with this server.

API library should contain 2 functions:

import { request, requestSession } from './index.js';
Note: request is OUR function, not a built-in NodeJS module

Client's request() function can use fetch, axios, gaxios (any HTTP library of your choice) under hood

The client must act as synchronous commands:

// client ensures that all requests act as sync
request('GET', '/pets') // => []
request('POST', '/pets', { name: 'dog'})
request('GET', '/pets') // => [{ name: 'dog' }]
When request depends on result of other use await:

request('POST', '/pets', { name: 'cat'})
const pet = await request('POST', '/pets', { name: 'dog'})
request('GET', '/pets') // => [{ name: 'cat'}, { name: 'dog' }]
request('GET', '/pets/' + pet.id) //
A different user can spawn their own API requests:

// user 1
request.auth = 1
request('POST', '/pets', { name: 'cat'})
request('POST', '/pets', { name: 'dog'})
requestSession(() => {
// here authorization for 2nd user comes
request.auth = 2
request('GET', '/pets') // => []
})
// roll back to user 1 auth
request('GET', '/pets') // => [{ name: 'cat'}, { name: 'dog' }]
And even get results from session:

// user 1
request.auth = 1
request('POST', '/pets', { name: 'cat'})
request('POST', '/pets', { name: 'dog'})
const otherPet = await requestSession(() => {
// here authorization for 2nd user comes
request.auth = 2
return request('POST', '/pets', { name: 'jaguar' }) // => []
})
// roll back to user 1 auth
const myPets = await request('GET', '/pets') // => [{ name: 'cat'}, { name: 'dog' }]

assert(
// no we don't have Jaguar at home but worth checking!
myPets.map(p => p.name).includes(otherPet.name)
)
Client should automatically handle:

stop execution if request takes longer than 1s
retry if server responds with 500 or 401
Result We Check
working client API that can be added to custom JS script
built-in logging (node-debug is preferable https://www.npmjs.com/package/debug)
all use cases above working:
chain of requests that don't need data retrival can work inside sync function()
await is needed only if we need to use data from API
multiple sessions can be spawned, they won't interfere, and their results can be combined
What We Test
You really understand how promises work in JavaScript, and how async/await work under hood.
You know what is Promise.race and Promise.all
You know how to dynamically combine promise chains
You know how to make promise retries
Implementation
web server can be vibe coded with AI tests
use JS or TS (no preference from our side)
2-6 hours of implementation
recommended to think about implementation before coding
client part should not be AI generated
unit tests included
