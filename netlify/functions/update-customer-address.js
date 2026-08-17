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
        body: JSON.stringify({ error: 'Secret key not configured' }),
      };
    }

    const { customerId, address, name } = JSON.parse(event.body);

    if (!customerId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing customerId' }),
      };
    }
    if (!address || !address.line1 || !address.country) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Incomplete address' }),
      };
    }

    const stripe = Stripe(key);

    const updateParams = { address };
    if (name) updateParams.name = name;

    const customer = await stripe.customers.update(customerId, updateParams);

    console.log('Customer address updated:', customer.id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error('Stripe customer update error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
