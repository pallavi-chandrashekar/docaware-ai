# Mongoose v7 Migration Guide

## Breaking Changes

### Removed Callback Support

All Mongoose model methods that previously accepted callbacks **no longer support them** in v7. You must use promises or async/await.

#### `mongoose.connect()` with callback

Old (v6):
```js
mongoose.connect("mongodb://localhost/myapp", {}, function (err) {
  if (err) console.error(err);
  console.log("Connected");
});
```

New (v7):
```js
try {
  await mongoose.connect("mongodb://localhost/myapp");
  console.log("Connected");
} catch (err) {
  console.error(err);
}
```

#### `Model.find()` with callback

Old (v6):
```js
User.find({ age: { $gte: 18 } }, function (err, users) {
  if (err) console.error(err);
  console.log(users);
});
```

New (v7):
```js
const users = await User.find({ age: { $gte: 18 } });
console.log(users);
```

#### `Model.findOneAndUpdate()` with callback

Old (v6):
```js
User.findOneAndUpdate(
  { email: "a@b.com" },
  { $set: { name: "New" } },
  { new: true },
  function (err, doc) {
    console.log(doc);
  }
);
```

New (v7):
```js
const doc = await User.findOneAndUpdate(
  { email: "a@b.com" },
  { $set: { name: "New" } },
  { new: true }
);
console.log(doc);
```

### Removed Connection Options

Several connection and schema options that were already no-ops in v6 have been **completely removed** in v7. Passing them will throw an error.

#### `useNewUrlParser`

Old (v6):
```js
mongoose.connect(uri, { useNewUrlParser: true });
```

New (v7):
```js
mongoose.connect(uri);
// useNewUrlParser is no longer needed; the new URL parser is always used.
```

#### `useUnifiedTopology`

Old (v6):
```js
mongoose.connect(uri, { useUnifiedTopology: true });
```

New (v7):
```js
mongoose.connect(uri);
// useUnifiedTopology is no longer needed; the unified topology is always used.
```

#### `useCreateIndex`

Old (v6):
```js
new Schema({ name: String }, { useCreateIndex: true });
```

New (v7):
```js
new Schema({ name: String });
// useCreateIndex is no longer needed; ensureIndex is no longer used internally.
```

#### `useFindAndModify`

Old (v6):
```js
User.findOneAndUpdate(filter, update, { useFindAndModify: false });
```

New (v7):
```js
User.findOneAndUpdate(filter, update);
// useFindAndModify option is removed; findOneAndUpdate always uses findOneAndUpdate command.
```

### Removed Methods

#### `Model.count()`

`Model.count()` has been **removed**. Use `Model.countDocuments()` for counting documents matching a filter, or `Model.estimatedDocumentCount()` for a fast approximate count of the entire collection.

Old (v6):
```js
const total = await User.count();
```

New (v7):
```js
const total = await User.countDocuments();
// or for an estimate without a filter:
const approx = await User.estimatedDocumentCount();
```

#### `Model.update()`

`Model.update()` has been **removed**. Use `Model.updateOne()` or `Model.updateMany()` instead.

Old (v6):
```js
await User.update({ active: false }, { $set: { archived: true } });
```

New (v7):
```js
await User.updateMany({ active: false }, { $set: { archived: true } });
```

### Correct Usage (unchanged)

These patterns continue to work in v7:
```js
await mongoose.connect(uri);
const users = await User.find({ active: true });
const count = await Post.countDocuments({ author: { $exists: true } });
const doc = await User.findOneAndUpdate(filter, update, { new: true });
await User.updateOne(filter, update);
await User.updateMany(filter, update);
```
