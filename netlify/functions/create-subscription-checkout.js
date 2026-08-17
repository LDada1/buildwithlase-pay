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

    const {
      domainName,
      includeDomain,
      domainPriceGBP,
      includeEmail,
      emailTier,
      emailUnitPriceGBP,
      mailboxQty,
      accountType,
      billingName,
      contactName,
      companyName,
      companyRegNo,
      customerEmail,
      customerPhone,
      currency,
    } = JSON.parse(event.body);

    const cur = (currency || 'gbp').toLowerCase();
    const stripe = Stripe(key);
    const line_items = [];

    if (includeDomain) {
      const amt = Math.round(Number(domainPriceGBP) * 100);
      if (!amt || amt <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid domain price' }),
        };
      }
      line_items.push({
        price_data: {
          currency: cur,
          unit_amount: amt,
          recurring: { interval: 'year' },
          product_data: {
            name: 'Domain Renewal' + (domainName ? ' — ' + domainName : ''),
          },
        },
        quantity: 1,
      });
    }

    if (includeEmail) {
      const unit = Math.round(Number(emailUnitPriceGBP) * 100);
      const qty = Math.max(1, parseInt(mailboxQty, 10) || 1);
      if (!unit || unit <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid email price' }),
        };
      }
      line_items.push({
        price_data: {
          currency: cur,
          unit_amount: unit,
          recurring: { interval: 'year' },
          product_data: {
            name: 'Custom Email Hosting' + (emailTier ? ' (' + emailTier + ')' : '') + ' — per mailbox',
          },
        },
        quantity: qty,
      });
    }

    if (line_items.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No items selected' }),
      };
    }

    const origin =
      (event.headers && (event.headers.origin || (event.headers.host ? 'https://' + event.headers.host : null))) ||
      'https://buildwithlase-pay.netlify.app';

    // Create a real Stripe Customer up front (rather than letting Checkout
    // create an anonymous one) so the org's name, company reg number, and
    // contact details are attached to every future invoice, receipt and the
    // customer portal from day one.
    const customerParams = {
      name: billingName || contactName || undefined,
      email: customerEmail || undefined,
      phone: customerPhone || undefined,
      metadata: {
        accountType: accountType || 'individual',
        contactName: contactName || '',
        companyName: companyName || '',
        companyRegNo: companyRegNo || '',
        domainName: domainName || '',
      },
    };
    if (companyRegNo) {
      customerParams.invoice_settings = {
        custom_fields: [{ name: 'Company Reg No', value: companyRegNo.slice(0, 30) }],
      };
    }
    const customer = await stripe.customers.create(customerParams);

    console.log('Creating subscription checkout for', domainName, billingName, line_items.length, 'line items');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items,
      customer: customer.id,
      // Let Checkout collect the billing address at payment time and write
      // it back onto the Customer record we just created, so invoices carry
      // a full postal address without us building our own address form.
      customer_update: { address: 'auto', name: 'auto' },
      success_url: origin + '/?sub_success=1&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/',
      phone_number_collection: { enabled: true },
      billing_address_collection: 'required',
      metadata: {
        domainName: domainName || '',
        accountType: accountType || 'individual',
        billingName: billingName || '',
        contactName: contactName || '',
        companyName: companyName || '',
        companyRegNo: companyRegNo || '',
        customerPhone: customerPhone || '',
        includeDomain: String(!!includeDomain),
        includeEmail: String(!!includeEmail),
        emailTier: emailTier || '',
        mailboxQty: String(mailboxQty || ''),
      },
      subscription_data: {
        metadata: {
          domainName: domainName || '',
          accountType: accountType || 'individual',
          billingName: billingName || '',
          contactName: contactName || '',
          companyName: companyName || '',
          companyRegNo: companyRegNo || '',
        },
      },
    });

    console.log('Checkout session created:', session.id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Stripe subscription error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};