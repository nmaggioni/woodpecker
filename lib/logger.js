'use strict';

const signale = require('signale');

class InteractiveLoopLogger {
  constructor(scope, baseMsg, totalCount) {
    this.signale = new signale.Signale({ interactive: true, scope: scope });
    this.baseMsg = baseMsg;
    this.totalProgress = totalCount;
    this.currentProgress = 0;
  }

  progress(i) {
    this.currentProgress = i;
    this.signale.await(`${this.baseMsg} [%s/%s]...`, this.currentProgress, this.totalProgress);
  }

  increment() {
    this.progress(this.currentProgress + 1);
  }

  complete() {
    this.signale.success(`${this.baseMsg} [%s/%s]`, this.currentProgress, this.totalProgress);
    console.log();  // https://github.com/klaussinani/signale/issues/44
  }
}

module.exports = {
  info: signale.info,
  warn: signale.warn,
  error: signale.error,
  InteractiveLoopLogger: InteractiveLoopLogger,
};
