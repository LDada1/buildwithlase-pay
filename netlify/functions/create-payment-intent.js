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

    const {
      amount, currency, package: pkg, paymentType,
      accountType, billingName, contactName,
      companyName, companyRegNo, customerEmail, customerPhone,
    } = JSON.parse(event.body);

    console.log('Creating payment intent for', amount, currency, pkg, paymentType, billingName);

    const stripe = Stripe(key);

    // Create (or reuse) a Customer so receipts, records and any future
    // subscriptions for this client are tied to one place in Stripe.
    let customerId;
    if (customerEmail) {
      const customerParams = {
        name: billingName || contactName || undefined,
        email: customerEmail,
        phone: customerPhone || undefined,
        metadata: {
          accountType: accountType || 'individual',
          contactName: contactName || '',
          companyName: companyName || '',
          companyRegNo: companyRegNo || '',
        },
      };
      if (companyRegNo) {
        customerParams.invoice_settings = {
          custom_fields: [{ name: 'Company Reg No', value: companyRegNo.slice(0, 30) }],
        };
      }
      const customer = await stripe.customers.create(customerParams);
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency || 'gbp',
      customer: customerId,
      receipt_email: customerEmail || undefined,
      metadata: {
        package: pkg,
        paymentType,
        accountType: accountType || 'individual',
        billingName: billingName || '',
        contactName: contactName || '',
        companyName: companyName || '',
        companyRegNo: companyRegNo || '',
        customerEmail: customerEmail || '',
        customerPhone: customerPhone || '',
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret, customerId: customerId || null }),
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
