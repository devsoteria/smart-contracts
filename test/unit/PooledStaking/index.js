const setup = require('./setup');
const snapshot = require('../utils').snapshot;
const coverage = true;

describe('PooledStaking unit tests', function () {

  this.timeout(0);
  this.slow(2000);

  if (!coverage) {

    before(setup);

    beforeEach(async function () {
      this.snapshotId = await snapshot.takeSnapshot();
    });

    afterEach(async function () {
      await snapshot.revertToSnapshot(this.snapshotId);
    });

  } else {

    beforeEach(setup);

  }

  require('./updateUintParameters');
  require('./depositAndStake');
  require('./withdraw');
  require('./withdrawReward');
  require('./requestUnstake');
  require('./processFirstUnstakeRequest');
  require('./pushBurn');
  require('./processBurn');
  require('./pushReward');
  require('./processFirstReward');
  require('./getters');
  require('./accumulateReward');
});
