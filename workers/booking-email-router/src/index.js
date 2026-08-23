const DESTINATIONS_ENV = 'BOOKING_FORWARD_DESTINATIONS';

function getDestinations(env) {
  const destinations = String(env?.[DESTINATIONS_ENV] || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(destinations)].filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value));
}

export default {
  async email(message, env) {
    const destinations = getDestinations(env);
    if (destinations.length !== 2) {
      console.error('[booking-email-router] Expected exactly two verified destinations.');
      message.setReject('Temporary routing configuration error.');
      return;
    }

    await Promise.all(destinations.map(destination => message.forward(destination)));
  },
};

export { getDestinations };
