# Axios v1.x Migration Guide (from v0.x)

## Breaking Changes

### `CancelToken` Removed

The `axios.CancelToken` API has been **removed** in v1.x. Use the native `AbortController` instead.

Old (v0.x):
```js
const source = axios.CancelToken.source();
axios.get("/api/data", { cancelToken: source.token });
source.cancel("Cancelled");
```

New (v1.x):
```js
const controller = new AbortController();
axios.get("/api/data", { signal: controller.signal });
controller.abort();
```

The `axios.isCancel(error)` check still exists for backward compatibility but should be replaced with checking `error.code === 'ERR_CANCELED'` or catching `AbortError`.

### `baseURL` Casing

The config property must be spelled `baseURL` (uppercase "URL"). A common mistake is writing `baseUrl` (lowercase "l"), which is **silently ignored** and causes requests to be sent to relative paths instead of the intended base.

Wrong:
```js
const client = axios.create({
  baseUrl: "https://api.example.com",
});
```

Correct:
```js
const client = axios.create({
  baseURL: "https://api.example.com",
});
```

### `transformRequest` Must Return Data

In v0.x, `transformRequest` functions could mutate `data` and `headers` without explicitly returning the data. In v1.x, you **must return the transformed data** from each transform function or the request body will be `undefined`.

Old (v0.x — worked by accident):
```js
transformRequest: [function(data, headers) {
  headers['X-Custom'] = 'value';
  // no return — v0.x still sent the original data
}]
```

New (v1.x):
```js
transformRequest: [function(data, headers) {
  headers['X-Custom'] = 'value';
  return data; // must explicitly return
}]
```

### `transformResponse` Internal Changes

In v0.x, `transformResponse` always received the raw response string. In v1.x, the default JSON transform runs first, so custom `transformResponse` functions may receive **already-parsed objects** instead of raw strings. Calling `JSON.parse()` on an already-parsed object throws.

Old (v0.x):
```js
transformResponse: [function(data) {
  const parsed = JSON.parse(data); // data was always a string
  return parsed;
}]
```

New (v1.x):
```js
transformResponse: [function(data) {
  // data may already be an object if Content-Type is application/json
  const obj = typeof data === 'string' ? JSON.parse(data) : data;
  return obj;
}]
```

## Best Practices

### Error Handling with `axios.isAxiosError()`

Always use `axios.isAxiosError(error)` before accessing `error.response`. Network errors and timeouts produce errors where `error.response` is `undefined`, causing `TypeError: Cannot read properties of undefined`.

Bad:
```js
catch (error) {
  const msg = error.response.data.message; // crashes on network error
}
```

Good:
```js
catch (error) {
  if (axios.isAxiosError(error) && error.response) {
    const msg = error.response.data.message;
  }
}
```

## Correct Usage (unchanged)

These patterns work correctly in both v0.x and v1.x:

```js
// AbortController-based cancellation (v1.x native)
const controller = new AbortController();
const response = await axios.get(url, { signal: controller.signal });

// Proper baseURL casing
const client = axios.create({ baseURL: "https://api.example.com" });

// Safe error handling
try {
  await axios.get("/data");
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.error(error.response?.data?.message);
  }
}
```
