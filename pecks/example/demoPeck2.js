'use strict';

module.exports = {
  target: {
    path: '/meta/ping',
    method: 'POST',
    body: {
      foo: 'bar',
    },
  },
  config: {
    chances: 30,
    atLeastOnce: false,
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
