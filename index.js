#!/usr/bin/env node

'use strict';

const { performance } = require('perf_hooks');
const axios = require('axios');
const commander = require('commander');
const fs = require('fs').promises;
const util = require('util');
const glob = util.promisify(require('glob'));
const path = require('path');
const Table = require('cli-table3');

const logger = require('./lib/logger');
const random = require('./lib/random');
let interactiveLoopLogger;

const version = process.env.npm_package_version || require('./package').version;
const stats = {};

const tokenizePeck = (peck) => {
  return `${JSON.stringify(peck.target)}.${JSON.stringify(peck.config)}`;
};

const parseCLI = () => {
  commander
    .name('./index.js')
    .version(version)
    .arguments('<base-url>')
    .action((baseUrl) => {
      while (baseUrl && baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      commander.baseUrl = baseUrl;
    })
    .option('-c, --count <number>', 'How many times to repeat the test. Defaults to 100.', (i, _) => parseInt(i))
    .option('-r, --report <file>', 'The file to write the report to. If empty, no detailed report will be generated.')
    .option('-t, --type <type>', 'The type of report to generate (csv, json). Defaults to JSON.')
    .parse(process.argv);
  if (!commander.baseUrl) {
    logger.error('Missing base URL. Check "./index.js -h" for help.\n');
    process.exit(1);
  }
  if (!commander.count) {
    commander.count = 100;
  }
  if (commander.report) {
    if (!commander.type) {
      commander.type = 'json';
    } else if (!['csv', 'json'].includes(commander.type)) {
      logger.error('Invalid report type requested. Check "./index.js -h" for help.\n');
      process.exit(1);
    }
  }
  if (commander.type && !commander.report) {
    logger.error('Report type specified but no output file ("-r") given. Check "./index.js -h" for help.\n');
    process.exit(1);
  }
};

(async () => {
  console.log(`\n🌳🐦 Woodpecker v${version}\n`);
  parseCLI();

  interactiveLoopLogger = new logger.InteractiveLoopLogger('load   ', 'Loading pecks', '?');
  interactiveLoopLogger.progress(0);
  const peckFiles = await glob(path.join(__dirname, 'pecks', '**', '*.js'));
  const pecks = [];
  for (const peckFile of peckFiles) {
    interactiveLoopLogger.increment();
    // TODO: check peck format
    pecks.push(require(peckFile));
  }
  interactiveLoopLogger.complete();

  interactiveLoopLogger = new logger.InteractiveLoopLogger('prepare', 'Preparing pecks', pecks.length);
  interactiveLoopLogger.progress(0);
  for (const peck of pecks) {
    interactiveLoopLogger.increment();
    peck.statsToken = tokenizePeck(peck);
    stats[peck.statsToken] = {
      peck: peck,
      hits: [],
    };
    peck.environment.prepare();
  }
  interactiveLoopLogger.complete();

  interactiveLoopLogger = new logger.InteractiveLoopLogger('run    ', 'Running pecks', pecks.length * commander.count);
  interactiveLoopLogger.progress(0);
  for (const _ of [...Array(commander.count).keys()]) {
    for (const peck of pecks) {
      const shouldRun = random.int(0, 100) <= peck.config.chances;
      if (shouldRun || (peck.config.atLeastOnce && stats[peck.statsToken].hits.length === 0)) {
        let promise;
        switch (peck.target.method) {
          case 'GET':
            promise = axios.get(commander.baseUrl.concat(peck.target.path));
            break;
          case 'POST':
            promise = axios.post(
              commander.baseUrl.concat(peck.target.path),
              peck.target.body,
            );
            break;
          default:
            logger.error('Unknown request type, skipping');
        }
        let success = true;
        const startMs = performance.now();
        try {
          await promise;
        } catch (e) {
          success = false;
        }
        const endMs = performance.now();

        stats[peck.statsToken].hits.push({
          duration: endMs - startMs,
          success: success,
        });
      }
      interactiveLoopLogger.increment();
    }
  }
  interactiveLoopLogger.complete();

  interactiveLoopLogger = new logger.InteractiveLoopLogger('cleanup', 'Cleaning up', pecks.length);
  interactiveLoopLogger.progress(0);
  for (const peck of pecks) {
    peck.environment.cleanup();
    interactiveLoopLogger.increment();
  }
  interactiveLoopLogger.complete();

  interactiveLoopLogger = new logger.InteractiveLoopLogger('stats  ', 'Processing stats', pecks.length);
  interactiveLoopLogger.progress(0);
  const processedStats = [];
  for (const peckStat in stats) {
    if (stats.hasOwnProperty(peckStat)) {
      const aggregatedStats = stats[peckStat].hits.reduce(
        (acc, el) => {
          acc.totalTime += el.duration;
          if (el.success) {
            acc.successes++;
          } else {
            acc.failures++;
          }
          return acc;
        }, {
          totalTime: 0,
          successes: 0,
          failures: 0,
        },
      );
      processedStats.push({
        method: stats[peckStat].peck.target.method,
        path: stats[peckStat].peck.target.path,
        hits: stats[peckStat].hits.length,
        successes: aggregatedStats.successes,
        failures: aggregatedStats.failures,
        avgMs: Math.round((aggregatedStats.totalTime / stats[peckStat].hits.length) * 100) / 100,
      });
      interactiveLoopLogger.increment();
    }
  }
  interactiveLoopLogger.complete();

  const table = new Table({
    head: ['Method', 'Path', '# of Hits', '# of Successes', '# of Failures', 'Average Duration'],
  });
  for (const entry of processedStats) {
    table.push([entry.method, entry.path, entry.hits, entry.successes, entry.failures, `${entry.avgMs} ms`]);
  }
  console.log(table.toString());

  if (commander.report) {
    let reportData;
    switch (commander.type) {
      case 'json':
        reportData = JSON.stringify(processedStats, null, 2);
        break;
      case 'csv':
        const csv = ['Method,Path,# of Hits,# of Successes,# of Failures,Average Duration\n'];
        for (const entry of processedStats) {
          csv.push(`${entry.method},${entry.path},${entry.hits},${entry.successes},${entry.failures},${entry.avgMs}\n`);
        }
        reportData = csv.join('');
        break;
    }
    await fs.writeFile(commander.report, reportData);
  }
})();
