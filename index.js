const express = require('express');
const app = express();
const path = require('path');

const envFilePath = path.resolve(__dirname, './.env');
const env = require('dotenv').config({ path: envFilePath });
if (env.error) {
	throw new Error(
		`Unable to load the .env file from ${envFilePath}. Please copy .env.example to ${envFilePath}`
	);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
	apiVersion: '2020-08-27',
});

app.use(express.static('public'));
app.use(express.urlencoded());
app.use(
	express.json({
		verify: function (req, res, buf) {
			if (req.originalUrl.startsWith('/webhook')) {
				req.rawBody = buf.toString();
			}
		},
	})
);

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
	const { sessionId } = req.query;
	const session = await stripe.checkout.sessions.retrieve(sessionId);
	res.send(session);
});

app.post('/create-checkout-session', async (req, res) => {
	const { priceId } = req.body;

	try {
		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			success_url: `${process.env.DOMAINE_NAME}/success.html?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.DOMAINE_NAME}/canceled.html`,
		});

		return res.redirect(303, session.url);
	} catch (e) {
		console.log('Error: ', e.message);
		res.status(400);
		return res.send({
			error: {
				message: e.message,
			},
		});
	}
});

app.post('/cancel-subscription', async (req, res) => {
	const { subscriptionId } = req.body;
	try {
		const subscription = await stripe.subscriptions.del(subscriptionId);
		return res.send(subscription);
	} catch (e) {
		console.log('Error: ', e.message);
		res.status(400);
		return res.send({
			error: {
				message: e.message,
			},
		});
	}
});

app.get('/config', (req, res) => {
	res.send({
		publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
		basicPrice: process.env.BASIC_PRICE_ID,
		proPrice: process.env.PRO_PRICE_ID,
	});
});

app.post('/customer-portal', async (req, res) => {
	// For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
	// Typically this is stored alongside the authenticated user in your database.
	const { sessionId } = req.body;
	const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

	// This is the url to which the customer will be redirected when they are done
	// managing their billing with the portal.
	const returnUrl = process.env.DOMAIN;

	const portalSession = await stripe.billingPortal.sessions.create({
		customer: checkoutSession.customer,
		return_url: returnUrl,
	});

	res.redirect(303, portalSession.url);
});

// Webhook handler for asynchronous events.
app.post('/webhook', async (req, res) => {
	let data;
	let eventType;
	// Check if webhook signing is configured.
	if (process.env.STRIPE_WEBHOOK_SECRET) {
		// Retrieve the event by verifying the signature using the raw body and secret.
		let event;
		let signature = req.headers['stripe-signature'];

		try {
			event = stripe.webhooks.constructEvent(
				req.rawBody,
				signature,
				process.env.STRIPE_WEBHOOK_SECRET
			);
		} catch (err) {
			console.log(`⚠️  Webhook signature verification failed.`);
			return res.sendStatus(400);
		}
		// Extract the object from the event.
		data = event.data;
		eventType = event.type;
	} else {
		// Webhook signing is recommended, but if the secret is not configured in `config.js`,
		// retrieve the event data directly from the request body.
		data = req.body.data;
		eventType = req.body.type;
	}

	if (eventType === 'checkout.session.completed') {
		console.log(`🔔  Payment received!`);
	}

	res.sendStatus(200);
});

app.listen(4242, () =>
	console.log(`Node server listening at http://localhost:${4242}/`)
);
