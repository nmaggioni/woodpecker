'use strict';

module.exports = {
  int: (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;  // max & min are inclusive
  },
};
