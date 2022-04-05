document.addEventListener('DOMContentLoaded', async () => {
	const urlParams = new URLSearchParams(window.location.search);
	const sessionId = urlParams.get('session_id');
	const showInfoButton = document.querySelector('#showInfo');
	let subscriptionId = '';

	showInfoButton.addEventListener('click', async () => {
		if (sessionId) {
			document.querySelector('#sessionId').textContent = sessionId;

			const session = await fetch(
				`/checkout-session?sessionId=${sessionId}`
			).then((r) => r.json());
			var sessionJSON = JSON.stringify(session, null, 2);
			document.querySelector('pre').textContent = sessionJSON;
		}
	});

	const cancelSubscriptionButton = document.querySelector(
		'#cancelSubscription'
	);

	cancelSubscriptionButton.addEventListener('click', async () => {
		// get id of subscription
		const session = await fetch(
			`/checkout-session?sessionId=${sessionId}`
		).then((r) => r.json());
		subscriptionId = session.subscription;
		console.log(subscriptionId);
		// cancel subscription
		await fetch('/cancel-subscription', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				subscriptionId: subscriptionId,
			}),
		});
		window.location.href = '/canceled.html';
	});
});
