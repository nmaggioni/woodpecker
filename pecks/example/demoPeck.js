'use strict';

module.exports = {
  target: {
    path: '/meta/healthcheck',
    method: 'GET',
    body: null,
  },
  config: {
    chances: 60,
    atLeastOnce: true,
  },
  environment: {
    prepare: () => {
      // Prepare your payload
    },
    cleanup: () => {
      // Clean up unneeded resources
    },
  },
};
