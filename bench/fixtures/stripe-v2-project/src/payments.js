// Benchmark fixture: Stripe API usage with known issues
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GROUND TRUTH: security - Using API key directly in code
const insecureStripe = new Stripe("sk_live_abc123");

export async function createCharge(amount, token) {
  // GROUND TRUTH: deprecated_api - charges.create is legacy, use PaymentIntents
  const charge = await stripe.charges.create({
    amount: amount,
    currency: "usd",
    source: token,
    description: "Example charge",
  });
  return charge;
}

export async function listCustomers() {
  // GROUND TRUTH: anti_pattern - no pagination handling
  const customers = await stripe.customers.list();
  return customers.data;
}

export async function handleWebhook(req) {
  // GROUND TRUTH: security - not verifying webhook signature
  const event = JSON.parse(req.body);

  switch (event.type) {
    case "payment_intent.succeeded":
      console.log("Payment succeeded:", event.data.object.id);
      break;
    case "payment_intent.payment_failed":
      console.log("Payment failed");
      break;
  }
}

// This is correct usage — should NOT be flagged
export async function createPaymentIntent(amount) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
  });
  return paymentIntent;
}
