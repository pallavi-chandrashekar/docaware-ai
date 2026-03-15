// Benchmark fixture: Express v4 patterns that break in v5
import express from "express";

const app = express();

// GROUND TRUTH: deprecated_api - app.del() removed in v5, use app.delete()
app.del("/users/:id", (req, res) => {
  res.json({ deleted: req.params.id });
});

// GROUND TRUTH: incorrect_usage - req.param() removed in v5
app.get("/search", (req, res) => {
  const query = req.param("q");
  res.json({ query });
});

// GROUND TRUTH: deprecated_api - res.json(status, body) signature removed in v5
app.post("/api/data", (req, res) => {
  res.json(200, { success: true });
});

// GROUND TRUTH: incorrect_usage - res.send(status) with number removed
app.get("/health", (req, res) => {
  res.send(200);
});

// GROUND TRUTH: anti_pattern - string pattern routes changed in v5
app.get("/users/:id(\\d+)", (req, res) => {
  res.json({ id: req.params.id });
});

// This is correct usage — should NOT be flagged
app.get("/api/items", (req, res) => {
  res.json({ items: [] });
});

app.listen(3000);
