# Stripe Node.js SDK Best Practices & Migration Guide

## Security

### API Key Handling
**Never hardcode API keys** in source code. Always use environment variables.

Bad:
```js
const stripe = new Stripe("sk_live_abc123");
```

Good:
```js
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

### Webhook Signature Verification
**Always verify webhook signatures** using `stripe.webhooks.constructEvent()`. Parsing the raw body with `JSON.parse()` without verification is a **security vulnerability**.

Bad:
```js
const event = JSON.parse(req.body);
```

Good:
```js
const event = stripe.webhooks.constructEvent(
  req.rawBody,
  req.headers["stripe-signature"],
  endpointSecret
);
```

## Deprecated APIs

### Charges API
`stripe.charges.create()` is the **legacy** payment API. Use `stripe.paymentIntents.create()` instead for all new integrations.

Deprecated:
```js
const charge = await stripe.charges.create({
  amount: 2000,
  currency: "usd",
  source: "tok_visa",
});
```

Recommended:
```js
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: "usd",
  automatic_payment_methods: { enabled: true },
});
```

## Anti-Patterns

### List Pagination
When calling `stripe.customers.list()` or any list endpoint, **always handle pagination**. The default limit is 10, and results may be truncated.

Bad:
```js
const customers = await stripe.customers.list();
return customers.data; // May miss records!
```

Good:
```js
const customers = [];
for await (const customer of stripe.customers.list({ limit: 100 })) {
  customers.push(customer);
}
```

## Correct Usage

These patterns are correct and recommended:
```js
// PaymentIntents (modern API)
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: "usd",
  automatic_payment_methods: { enabled: true },
});

// Proper webhook handling
const event = stripe.webhooks.constructEvent(body, sig, secret);
```
