# Express v5 Migration Guide

## Breaking Changes

### Removed Methods

#### `app.del()`
`app.del()` has been **removed**. Use `app.delete()` instead.

Old (v4):
```js
app.del("/resource/:id", handler);
```

New (v5):
```js
app.delete("/resource/:id", handler);
```

#### `req.param(name)`
`req.param()` has been **removed**. Use `req.params`, `req.query`, or `req.body` directly.

Old (v4):
```js
const value = req.param("name");
```

New (v5):
```js
const value = req.params.name || req.query.name || req.body.name;
```

### Changed Signatures

#### `res.json(status, body)`
The two-argument form `res.json(status, body)` is **no longer supported**. Use chaining.

Old (v4):
```js
res.json(200, { success: true });
```

New (v5):
```js
res.status(200).json({ success: true });
```

#### `res.send(status)`
Calling `res.send()` with a number (status code) is **no longer supported**. Use `res.sendStatus()`.

Old (v4):
```js
res.send(200);
```

New (v5):
```js
res.sendStatus(200);
```

### Route Path Syntax

String-based regex patterns in route paths have **changed**. The `:param(\\d+)` syntax now uses a different parser.

Old (v4):
```js
app.get("/users/:id(\\d+)", handler);
```

New (v5):
```js
app.get("/users/:id", handler);
// Use route-level validation instead of regex in path
```

### Correct Usage (unchanged)

These patterns continue to work in v5:
```js
app.get("/path", handler);
app.post("/path", handler);
res.json({ data: value });
res.status(200).json({ data: value });
```
