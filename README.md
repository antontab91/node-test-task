A minimal demo of a REST API client interacting with an in-memory web server.  
Built with Node.js and TypeScript.

## Features

- In-memory server with endpoints:
    - `GET /pets` → list all pets for current user
    - `GET /pets/:id` → get one pet
    - `POST /pet { name }` → create new pet
- Bearer token auth (`Authorization: Bearer <userId>`)
- Automatic user creation
- Random errors and hangs for reliability testing
- Client:
    - Sequential request chaining
    - `requestSession()` for isolated user contexts
    - Timeout (1s) + retries on 401/500
    - Debug logging via `node-debug`

## Scripts

```bash
npm run dev     # run demo (server + client)
npm run test    # run tests (no random errors)
```
