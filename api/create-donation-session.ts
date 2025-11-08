import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body; // amount in dollars (e.g., 5 for $5)

    // Get the origin for redirect URLs
    const origin = req.headers.origin || 'http://localhost:5173';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paynow'], // Include PayNow for Singapore
      line_items: [
        {
          price_data: {
            currency: 'sgd',
            product_data: {
              name: 'Support Pay How Much Ah',
              description: 'Thank you for supporting this free tool!',
            },
            unit_amount: Math.round(amount * 100), // Convert dollars to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/?donation=success`,
      cancel_url: `${origin}/?donation=cancelled`,
      metadata: {
        app: 'pay-how-much-ah',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ 
      error: 'Failed to create donation session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}