const Claims = artifacts.require('Claims');
const ClaimsData = artifacts.require('ClaimsDataMock');

const ClaimsReward = artifacts.require('ClaimsReward');
const DAI = artifacts.require('MockDAI');
const NXMaster = artifacts.require('NXMasterMock');
const MCR = artifacts.require('MCR');
const NXMToken = artifacts.require('NXMToken');
const TokenFunctions = artifacts.require('TokenFunctionMock');
const TokenController = artifacts.require('TokenController');
const TokenData = artifacts.require('TokenDataMock');
const Pool1 = artifacts.require('Pool1Mock');
const Pool2 = artifacts.require('Pool2');
const PoolData = artifacts.require('PoolDataMock');
const Quotation = artifacts.require('Quotation');
const QuotationDataMock = artifacts.require('QuotationDataMock');
const MemberRoles = artifacts.require('MemberRoles');
const Governance = artifacts.require('Governance');
const ProposalCategory = artifacts.require('ProposalCategory');
const FactoryMock = artifacts.require('FactoryMock');

const QE = '0xb24919181daead6635e613576ca11c5aa5a4e133';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
let Exchange_0x;
let snapshotId;

const {ether, toHex, toWei} = require('./utils/ethTools');
const {assertRevert} = require('./utils/assertRevert');
const gvProp = require('./utils/gvProposal.js').gvProposal;
const encode = require('./utils/encoder.js').encode;
const encode1 = require('./utils/encoder.js').encode1;
const getValue = require('./utils/getMCRPerThreshold.js').getValue;
const { takeSnapshot, revertSnapshot } = require('./utils/snapshot');

const BigNumber = web3.BigNumber;
require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let accounts = [];

let nxms;
let nxmtk;
let tf;
let tc;
let td;
let pl1;
let pl2;
let pd;
let qt;
let qd;
let cl;
let cr;
let cd;
let mcr;
let addr = [];
let dai;
let memberRoles;
let propCat;
let factory;

contract('NXMaster', function([
  owner,
  newOwner,
  member,
  nonMember,
  anotherAccount,
  govVoter1,
  govVoter2,
  govVoter3,
  govVoter4
]) {

  accounts = [
    owner,
    newOwner,
    member,
    nonMember,
    anotherAccount,
    govVoter1,
    govVoter2,
    govVoter3,
    govVoter4
  ];

  Exchange_0x = accounts[17];

  const fee = toWei(0.002);
  const poolEther = ether(2);
  const pauseTime = new web3.utils.BN(2419200);

  before(async function() {

    snapshotId = await takeSnapshot();

    factory = await FactoryMock.deployed();
    qd = await QuotationDataMock.deployed();
    nxms = await NXMaster.at(await qd.ms());
    td = await TokenData.deployed();
    tf = await TokenFunctions.deployed();
    tc = await TokenController.new();
    cd = await ClaimsData.deployed();
    pd = await PoolData.deployed();
    qt = await Quotation.deployed();
    nxmtk = await NXMToken.deployed();
    cl = await Claims.deployed();
    cr = await ClaimsReward.deployed();
    pl1 = await Pool1.deployed();
    pl2 = await Pool2.deployed();
    mcr = await MCR.deployed();
    dai = await DAI.deployed();
    propCat = await ProposalCategory.new();
    memberRoles = await MemberRoles.new();
    let oldMR = await MemberRoles.at(await nxms.getLatestAddress(toHex('MR')));
    let oldTk = await NXMToken.deployed();
    let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));

    for (let i = 5; i < 9; i++) {
      await oldMR.payJoiningFee(accounts[i], { from: accounts[i], value: fee });
      await oldMR.kycVerdict(accounts[i], true);
      const isMember = await nxms.isMember(accounts[i]);
      isMember.should.equal(true);
      await oldTk.transfer(accounts[i], toWei(37500));
    }

    async function updateCategory(nxmAdd, functionName, updateCat) {
      let actionHash = encode1(
        [
          'uint256',
          'string',
          'uint256',
          'uint256',
          'uint256',
          'uint256[]',
          'uint256',
          'string',
          'address',
          'bytes2',
          'uint256[]',
          'string'
        ],
        [
          updateCat,
          'Edit Category',
          2,
          50,
          15,
          [2],
          604800,
          '',
          nxmAdd,
          toHex('MS'),
          [0, 0, 80, 0],
          functionName
        ]
      );
      await gvProp(4, actionHash, oldMR, oldGv, 1);
    }

    await updateCategory(
      nxms.address,
      'upgradeMultipleImplementations(bytes2[],address[])',
      5
    );

    await updateCategory(
      nxms.address,
      'upgradeMultipleContracts(bytes2[],address[])',
      29
    );

  });

  describe('Updating state', function() {

    this.timeout(0);

    it('1.3 should be able to change single contract (proxy contracts)', async function() {

      let newMemberRoles = await MemberRoles.new();
      let actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('MR')], [newMemberRoles.address]]
      );

      let oldMR = await MemberRoles.at(await nxms.getLatestAddress(toHex('MR')));
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));

      await gvProp(5, actionHash, oldMR, oldGv, 2);
      (await qd.getImplementationAdd(toHex('MR'))).should.be.equal(newMemberRoles.address);
    });

    it('1.4 should set launch bit after adding initial members', async function() {
      memberRoles = await MemberRoles.at(await nxms.getLatestAddress(toHex('MR')));
      await memberRoles.addMembersBeforeLaunch([], []);
      (await memberRoles.launched()).should.be.equal(true);
    });

    it('1.5 should be able to reinitialize', async function() {

      let oldMR = await MemberRoles.at(await nxms.getLatestAddress(toHex('MR')));
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));

      await pl1.sendEther({from: owner, value: poolEther});

      let actionHash = encode(
        'updateOwnerParameters(bytes8,address)',
        'OWNER',
        nonMember
      );
      await gvProp(28, actionHash, oldMR, oldGv, 3);
      (await nxms.owner()).should.be.equal(nonMember);
      (await oldMR.checkRole(nonMember, 3)).should.be.equal(true);

      actionHash = encode(
        'updateOwnerParameters(bytes8,address)',
        'OWNER',
        owner
      );
      await gvProp(28, actionHash, oldMR, oldGv, 3);
      (await nxms.owner()).should.be.equal(owner);

      actionHash = encode(
        'updateOwnerParameters(bytes8,address)',
        'QUOAUTH',
        owner
      );
      await gvProp(28, actionHash, oldMR, oldGv, 3);
      (await qd.authQuoteEngine()).should.be.equal(owner);

      actionHash = encode(
        'updateOwnerParameters(bytes8,address)',
        'QUOAUTH',
        QE
      );
      await gvProp(28, actionHash, oldMR, oldGv, 3);
      let qeAdd = await qd.authQuoteEngine();
      let qeAdd1 = web3.utils.toChecksumAddress(qeAdd);
      let qeAdd2 = web3.utils.toChecksumAddress(QE);
      (qeAdd2 === qeAdd1).should.equal(true);

      actionHash = encode(
        'updateOwnerParameters(bytes8,address)',
        'MCRNOTA',
        QE
      );
      await gvProp(28, actionHash, oldMR, oldGv, 3);
      (await pd.notariseMCR()).should.be.equal(qeAdd2);

      actionHash = encode(
        'updateOwnerParameters(bytes8,address)',
        'MCRNOTA',
        owner
      );
      await gvProp(28, actionHash, oldMR, oldGv, 3);
      (await pd.notariseMCR()).should.be.equal(owner);
      await mcr.addMCRData(
        await getValue(toWei(2), pd, mcr),
        toWei(100),
        toWei(2),
        ['0x455448', '0x444149'],
        [100, 15517],
        20190103
      );
      await pl2.saveIADetails(
        ['0x455448', '0x444149'],
        [100, 15517],
        20190103,
        true
      ); // for testing
    });
  });

  describe('when called by unauthorised source', function() {
    it('1.9 should not be able to add a new version', async function() {
      await assertRevert(nxms.addNewVersion(addr, {from: anotherAccount}));
    });
  });

  describe('modifiers', function() {
    it('1.12 should return true if owner address', async function() {
      const isOwner = await nxms.isOwner(owner);
      isOwner.should.equal(true);
    });
    it('1.13 should return false if not owner address', async function() {
      const isOwner = await nxms.isOwner(newOwner);
      isOwner.should.equal(false);
    });
    it('1.14 should return true if internal contract address', async function() {
      const isInternal = await nxms.isInternal(nxms.address);
      isInternal.should.equal(true);
    });
    it('1.15 should return false if not internal contract address', async function() {
      const isInternal = await nxms.isInternal(newOwner);
      isInternal.should.equal(false);
    });
    it('1.16 should return true if member', async function() {
      await memberRoles.payJoiningFee(member, {from: member, value: fee});
      await memberRoles.kycVerdict(member, true);
      const isMember = await nxms.isMember(member);
      isMember.should.equal(true);
    });
    it('1.17 should return false if not member', async function() {
      const isMember = await nxms.isOwner(nonMember);
      isMember.should.equal(false);
    });
    it('1.18 should return false for no Emergency Pause', async function() {
      const isPause = await nxms.isPause();
      isPause.should.equal(false);
    });
  });

  describe('emergency pause ', function() {
    it('1.19 should return zero length for Emergency Pause', async function() {
      const len = await nxms.getEmergencyPausedLength();
      len.toString().should.be.equal(new web3.utils.BN(0).toString());
    });
    it('1.20 should return correct for last Emergency Pause', async function() {
      let check = false;
      const lastEP = await nxms.getLastEmergencyPause();
      if (lastEP[0] == false && lastEP[1] == 0) check = true;
      check.should.equal(true);
    });

    it('1.22 other address/contract should not be able to update pauseTime', async function() {
      // const updatePauseTime = pauseTime.addn(new web3.utils.BN(60));
      const updatePauseTime = pauseTime.toNumber() + 60;
      await assertRevert(
        nxms.updatePauseTime(updatePauseTime, {from: newOwner})
      );
      let pauseTime1 = await nxms.pauseTime();
      updatePauseTime.should.be.not.equal(pauseTime1.toNumber());
    });

    it('1.23 governance call should be able to update pauseTime', async function() {
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      actionHash = encode('updateUintParameters(bytes8,uint)', 'EPTIME', 12);
      await gvProp(22, actionHash, oldMR, oldGv, 2);
      let val = await oldGv.getUintParameters(toHex('EPTIME'));
      (val[1] / 1).should.be.equal(12);
    });
  });

  describe('upgrade single non-proxy contracts', function() {
    it('1.24 should able to propose new contract code for quotation', async function() {
      let newQt = await Quotation.new();
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('QT')], [newQt.address]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
      (await nxms.getLatestAddress(toHex('QT'))).should.be.equal(newQt.address);
    });
    it('1.25 should able to propose new contract code for claimsReward', async function() {
      let newCr = await ClaimsReward.new();
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('CR')], [newCr.address]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
      (await nxms.getLatestAddress(toHex('CR'))).should.be.equal(newCr.address);
    });
    it('1.26 should able to propose new contract code for Pool1', async function() {
      let newP1 = await Pool1.new();
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('P1')], [newP1.address]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
      (await nxms.getLatestAddress(toHex('P1'))).should.be.equal(newP1.address);
    });
    it('1.27 should able to propose new contract code for Pool2', async function() {
      let newP2 = await Pool2.new(factory.address);
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('P2')], [newP2.address]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
      (await nxms.getLatestAddress(toHex('P2'))).should.be.equal(newP2.address);
    });
    it('1.28 should able to propose new contract code for mcr', async function() {
      let newMcr = await MCR.new();
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('MC')], [newMcr.address]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
      (await nxms.getLatestAddress(toHex('MC'))).should.be.equal(
        newMcr.address
      );
    });
    it('1.29 should not trigger action if passed invalid address', async function() {
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      let mcrOld = await nxms.getLatestAddress(toHex('MC'));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('MC')], [ZERO_ADDRESS]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
      (await nxms.getLatestAddress(toHex('MC'))).should.be.equal(mcrOld);
    });
    it('1.30 should not trigger action if passed invalid contrcat code', async function() {
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      let mcrOld = await nxms.getLatestAddress(toHex('MC'));
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('P4')], [oldMR.address]]
      );
      await gvProp(29, actionHash, oldMR, oldGv, 2);
    });
  });

  describe('more test cases', function() {
    it('1.24 revert in case of upgrade implementation by non governance contract', async function() {
      await assertRevert(
        nxms.upgradeMultipleImplementations([toHex('TC')], [nxms.address])
      );
    });

    it('1.25 revert in case of applying EP directly', async function() {
      await assertRevert(nxms.addEmergencyPause(true, toHex('AB')));
    });
    it('1.26 even if passed by governance should not trigger action for wrong contrcat code', async function() {
      this.timeout(0);
      actionHash = encode1(
        ['bytes2[]', 'address[]'],
        [[toHex('AS')], [nxms.address]]
      );
      let oldMR = await MemberRoles.at(
        await nxms.getLatestAddress(toHex('MR'))
      );
      let oldGv = await Governance.at(await nxms.getLatestAddress(toHex('GV')));
      // await oldGv.changeDependentContractAddress();
      await gvProp(5, actionHash, oldMR, oldGv, 2);
    });
    it('1.27 revert in case of upgrade contract by non governance contract', async function() {
      assertRevert(
        nxms.upgradeMultipleContracts([toHex('TF')], [nxms.address])
      );
    });
  });

  after(async function () {
    await revertSnapshot(snapshotId);
  });

});
