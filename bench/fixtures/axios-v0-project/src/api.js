// Benchmark fixture: Axios v0.x patterns that break or are deprecated in v1.x
import axios from "axios";

// GROUND TRUTH: incorrect_usage - baseUrl (lowercase 'l') is silently ignored; must be baseURL
const client = axios.create({
  baseUrl: "https://api.example.com/v1",
  timeout: 5000,
});

// GROUND TRUTH: deprecated_api - CancelToken removed in v1.x, use AbortController
const source = axios.CancelToken.source();
client.get("/users", {
  cancelToken: source.token,
});
source.cancel("Request cancelled by user");

// GROUND TRUTH: deprecated_api - isCancel with CancelToken pattern removed in v1.x
async function fetchWithCancel(url) {
  const cancelSource = axios.CancelToken.source();
  try {
    const response = await client.get(url, {
      cancelToken: cancelSource.token,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log("Request was cancelled:", error.message);
    }
    throw error;
  }
}

// GROUND TRUTH: anti_pattern - accessing error.response.data without axios.isAxiosError() guard
async function unsafeErrorHandling() {
  try {
    const response = await client.post("/submit", { key: "value" });
    return response.data;
  } catch (error) {
    // This crashes on network errors where error.response is undefined
    const message = error.response.data.message;
    console.error("Server error:", message);
    throw new Error(message);
  }
}

// GROUND TRUTH: deprecated_api - transformRequest with (data, headers) must return data; old v0.x allowed mutation without return
client.interceptors.request.use((config) => {
  config.transformRequest = [
    function (data, headers) {
      headers["X-Custom-Auth"] = "token-abc";
      // v0.x tolerated not returning data; v1.x requires explicit return
    },
  ];
  return config;
});

// GROUND TRUTH: deprecated_api - transformResponse old signature; v1.x changed internal response handling
client.defaults.transformResponse = [
  function (data) {
    // v0.x allowed raw string manipulation; v1.x may pass already-parsed data
    const parsed = JSON.parse(data);
    parsed.timestamp = Date.now();
    return parsed;
  },
];

// This is correct v1.x-compatible usage — should NOT be flagged
async function safeRequest(url) {
  const controller = new AbortController();
  try {
    const response = await axios.get(url, {
      signal: controller.signal,
      baseURL: "https://api.example.com/v1",
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Axios error:", error.response?.data?.message);
    }
    throw error;
  }
}

// This is also correct — should NOT be flagged
async function healthCheck() {
  const response = await axios.get("/health", {
    baseURL: "https://api.example.com",
    validateStatus: (status) => status < 500,
  });
  return response.status === 200;
}
