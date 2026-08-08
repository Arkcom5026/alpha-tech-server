async function receive(payload, user) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('INVALID_PAYLOAD');
  }

  return {
    status: 'FOUNDATION_READY',
    receivedBy: user?.id || null,
    payload,
  };
}

module.exports = {
  receive,
};
