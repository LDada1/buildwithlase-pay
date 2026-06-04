const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const key = process.env.STRIPE_SECRET_KEY;

    if (!key) {
      console.error('STRIPE_SECRET_KEY is not set');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Secret key not configured' })
      };
    }

    const { amount, currency, package: pkg, paymentType } = JSON.parse(event.body);

    console.log('Creating payment intent for', amount, currency, pkg, paymentType);

    const stripe = Stripe(key);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency || 'gbp',
      metadata: { package: pkg, paymentType },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };

  } catch (error) {
    console.error('Stripe error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};