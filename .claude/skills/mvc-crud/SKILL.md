---
name: mvc-crud
description: Use when adding or changing a server-side resource / REST endpoint in the Express backend — MVC layering (routes → controllers → services → models) and CRUD conventions (routes, HTTP verbs, status codes, validation, DTOs).
---

# MVC + CRUD (Express backend)

The client is a React SPA, so the server's **View** is the JSON response (a DTO), not HTML templates.

## Layers
| Layer | Folder | Responsibility | May import |
|---|---|---|---|
| **Route** | `api/src/routes/` | Map HTTP verb + path → controller method; attach validation middleware | controllers |
| **Controller** | `api/src/controllers/` | Read validated input from `req`, call the service, choose status code, send the DTO (the *view*) | services, views |
| **Service** | `api/src/services/` | Business / game rules, orchestration; throws domain errors | models |
| **Model** | `api/src/models/` | Domain type + repository (data access: `models/sqlite/*` now, `models/supabase/*` later) | — |
| **View (DTO)** | `api/src/views/` | `toXxxDto(entity)` — shape of the JSON response, hides internal fields | models (types) |

Rules:
- Dependencies point **downward only**: route → controller → service → model. A model never imports a service;
  a service never touches `req`/`res`.
- Socket.IO handlers (`sockets/`) are another "controller" type: they call the **same services** as the
  HTTP controllers — no duplicated logic (see `dry`, `socket-io`).
- Repositories are interfaces; inject them into services so the storage can be swapped (see `solid`).
- One resource = one file per layer: `models/room.ts`, `services/roomService.ts`,
  `controllers/roomController.ts`, `routes/rooms.ts`, `views/roomView.ts`.

## CRUD conventions
Resource names are plural nouns, no verbs in paths, nested max one level (`/api/rooms/:roomId/players`).

| Operation | Method & path | Success | Typical errors |
|---|---|---|---|
| List | `GET /api/rooms` | `200` + array | — |
| Read | `GET /api/rooms/:id` | `200` + object | `404` |
| Create | `POST /api/rooms` | `201` + object (+ `Location` header) | `400`, `409` |
| Replace | `PUT /api/rooms/:id` | `200` + object | `400`, `404` |
| Update (partial) | `PATCH /api/rooms/:id` | `200` + object | `400`, `404` |
| Delete | `DELETE /api/rooms/:id` | `204` no body | `404` |

- Validate `params`, `query` and `body` before the controller runs (schema middleware); invalid → `400`.
- Error body is always `{ "error": string, "details"?: unknown }`.
- Services throw typed domain errors (`NotFoundError`, `ConflictError`, `ValidationError`);
  the central error handler maps them to status codes — controllers don't build error responses by hand.
- List endpoints support `?limit=&offset=` once the collection can grow; return `{ items, total }`.
- Create/update DTO types (`CreateRoomInput`, `UpdateRoomInput`) live in `shared/` so the client uses the same types.

## Example
```ts
// models/room.ts
export type Room = { readonly id: string; readonly name: string; readonly createdAt: Date };
export interface RoomRepository {
  findAll(): Promise<Room[]>;
  findById(id: string): Promise<Room | undefined>;
  save(room: Room): Promise<void>;
  delete(id: string): Promise<boolean>;
}

// services/roomService.ts
export const createRoomService = (repo: RoomRepository) => ({
  list: () => repo.findAll(),
  get: async (id: string) => (await repo.findById(id)) ?? throwNotFound('Room', id),
  create: async ({ name }: CreateRoomInput) => {
    const room: Room = { id: crypto.randomUUID(), name, createdAt: new Date() };
    await repo.save(room);
    return room;
  },
  remove: async (id: string) => { if (!(await repo.delete(id))) throwNotFound('Room', id); },
});
export type RoomService = ReturnType<typeof createRoomService>;

// views/roomView.ts
export const toRoomDto = ({ id, name, createdAt }: Room) => ({ id, name, createdAt: createdAt.toISOString() });

// controllers/roomController.ts
export const createRoomController = (rooms: RoomService) => ({
  list: async (_req: Request, res: Response) => { res.json((await rooms.list()).map(toRoomDto)); },
  get: async (req: Request<{ id: string }>, res: Response) => { res.json(toRoomDto(await rooms.get(req.params.id))); },
  create: async (req: Request, res: Response) => {
    const room = await rooms.create(req.body as CreateRoomInput); // body already validated by middleware
    res.status(201).location(`/api/rooms/${room.id}`).json(toRoomDto(room));
  },
  remove: async (req: Request<{ id: string }>, res: Response) => { await rooms.remove(req.params.id); res.status(204).end(); },
});

// routes/rooms.ts
export const createRoomsRouter = (rooms: RoomService) => {
  const c = createRoomController(rooms);
  return Router()
    .get('/', c.list)
    .get('/:id', c.get)
    .post('/', validateBody(createRoomSchema), c.create)
    .delete('/:id', c.remove);
};
```

## Avoid
- Fat controllers with business rules or data access.
- Returning internal entities directly (always map through a view/DTO).
- RPC-style paths (`/api/createRoom`, `/api/rooms/delete/:id`).
- Over-layering trivial endpoints: a health check needs no service/model ([[kiss]]).

Related: [[expressjs]], [[nodejs]], [[solid]], [[dry]], [[socket-io]].
