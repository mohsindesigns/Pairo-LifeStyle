import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_unset', {
  apiVersion: '2026-07-29.dahlia',
});

export default stripe;
