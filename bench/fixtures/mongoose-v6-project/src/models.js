// Benchmark fixture: Mongoose v6 patterns that break in v7
const mongoose = require("mongoose");

// GROUND TRUTH: deprecated_api - useCreateIndex option removed in v7
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true },
    age: { type: Number },
  },
  { useCreateIndex: true }
);

// GROUND TRUTH: deprecated_api - useNewUrlParser option removed in v7
// GROUND TRUTH: deprecated_api - useUnifiedTopology option removed in v7
mongoose.connect("mongodb://localhost:27017/myapp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// GROUND TRUTH: removed_api - connect() with callback removed in v7
mongoose.connect("mongodb://localhost:27017/myapp", {}, function (err) {
  if (err) console.error("Connection failed:", err);
  console.log("Connected");
});

const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model("Post", postSchema);

// GROUND TRUTH: removed_api - Model.find() with callback removed in v7
User.find({ age: { $gte: 18 } }, function (err, users) {
  if (err) console.error(err);
  console.log("Adults:", users);
});

// GROUND TRUTH: removed_api - Model.findOneAndUpdate() with useFindAndModify removed in v7
User.findOneAndUpdate(
  { email: "alice@example.com" },
  { $set: { name: "Alice Smith" } },
  { useFindAndModify: false, new: true },
  function (err, doc) {
    if (err) console.error(err);
    console.log("Updated:", doc);
  }
);

// GROUND TRUTH: removed_api - Model.count() removed in v7, use countDocuments()
async function getTotalUsers() {
  const total = await User.count();
  console.log("Total users:", total);
  return total;
}

// GROUND TRUTH: removed_api - Model.update() removed in v7, use updateOne()/updateMany()
async function deactivateOldUsers() {
  const result = await User.update(
    { age: { $lt: 13 } },
    { $set: { active: false } }
  );
  console.log("Deactivated:", result);
}

// This is correct v7-compatible code — should NOT be flagged
async function getActiveUsers() {
  const users = await User.find({ active: true }).exec();
  return users;
}

// This is correct v7-compatible code — should NOT be flagged
async function countPosts() {
  const count = await Post.countDocuments({ author: { $exists: true } });
  return count;
}

// Correct v7-compatible usage of findOneAndUpdate with promises
async function updateUserName(email, newName) {
  const updated = await User.findOneAndUpdate(
    { email },
    { $set: { name: newName } },
    { new: true }
  );
  return updated;
}

module.exports = { User, Post, getTotalUsers, getActiveUsers, countPosts, updateUserName, deactivateOldUsers };
