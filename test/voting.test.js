const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingSystem", function () {
  let votingSystem;
  let owner, voter1, voter2, voter3;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    const VotingSystem = await ethers.getContractFactory("VotingSystem");
    votingSystem = await VotingSystem.deploy();
  });

  describe("Create Poll", function () {
    it("Should create a poll successfully", async function () {
      const options = ["Option A", "Option B", "Option C"];
      const tx = await votingSystem.createPoll(
        "Test Poll",
        "A test poll",
        options,
        3600,
        3600
      );

      await expect(tx).to.emit(votingSystem, "PollCreated");

      const poll = await votingSystem.getPoll(0);
      expect(poll.title).to.equal("Test Poll");
      expect(poll.options.length).to.equal(3);
      expect(poll.creator).to.equal(owner.address);
    });

    it("Should fail if title is empty", async function () {
      const options = ["A", "B"];
      await expect(
        votingSystem.createPoll("", "Description", options, 3600, 3600)
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("Should fail if less than 2 options", async function () {
      const options = ["Only Option"];
      await expect(
        votingSystem.createPoll("Poll", "Desc", options, 3600, 3600)
      ).to.be.revertedWith("Poll must have at least 2 options");
    });

    it("Should fail if duration is 0", async function () {
      const options = ["A", "B"];
      await expect(
        votingSystem.createPoll("Poll", "Desc", options, 0, 3600)
      ).to.be.revertedWith("Commit duration must be > 0");
    });
  });

  describe("Commit Phase", function () {
    beforeEach(async function () {
      const options = ["Yes", "No", "Maybe"];
      await votingSystem.createPoll(
        "Test Poll",
        "Description",
        options,
        3600,
        3600
      );
    });

    it("Should commit a vote successfully", async function () {
      const voteIndex = 0;
      const salt = ethers.id("salt123");
      const hashedVote = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [voteIndex, salt]
      );

      const tx = await votingSystem.connect(voter1).commit(0, hashedVote);
      await expect(tx).to.emit(votingSystem, "CommitVote");

      const hasCommitted = await votingSystem.hasCommitted(0, voter1.address);
      expect(hasCommitted).to.be.true;
    });

    it("Should fail if committing twice from same address", async function () {
      const salt = ethers.id("salt123");
      const hashedVote = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [0, salt]
      );

      await votingSystem.connect(voter1).commit(0, hashedVote);

      await expect(
        votingSystem.connect(voter1).commit(0, hashedVote)
      ).to.be.revertedWith("Already committed");
    });

    it("Should fail if hash is zero", async function () {
      await expect(
        votingSystem.connect(voter1).commit(0, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid hash");
    });
  });

  describe("Basic Functionality", function () {
    it("Should prevent reveal before commit phase ends", async function () {
      const options = ["Yes", "No"];
      await votingSystem.createPoll("Poll", "Desc", options, 3600, 3600);

      const voteIndex = 0;
      const salt = ethers.id("salt");

      await expect(
        votingSystem.connect(voter1).reveal(0, voteIndex, salt)
      ).to.be.revertedWith("Commit phase not ended");
    });

    it("Should check poll count", async function () {
      const options = ["A", "B"];
      await votingSystem.createPoll("Poll 1", "Desc 1", options, 3600, 3600);
      await votingSystem.createPoll("Poll 2", "Desc 2", options, 3600, 3600);

      const count = await votingSystem.getPollCount();
      expect(count).to.equal(2);
    });
  });

  describe("Poll Data Structure", function () {
    it("Should store poll correctly", async function () {
      const options = ["Option A", "Option B"];
      await votingSystem.createPoll(
        "My Poll",
        "My Description",
        options,
        7200,
        7200
      );

      const poll = await votingSystem.getPoll(0);
      expect(poll.title).to.equal("My Poll");
      expect(poll.description).to.equal("My Description");
      expect(poll.options.length).to.equal(2);
      expect(poll.creator).to.equal(owner.address);
    });

    it("Should get all polls", async function () {
      const options = ["A", "B"];
      await votingSystem.createPoll("Poll 1", "Desc 1", options, 3600, 3600);
      await votingSystem.createPoll("Poll 2", "Desc 2", options, 3600, 3600);
      await votingSystem.createPoll("Poll 3", "Desc 3", options, 3600, 3600);

      const polls = await votingSystem.getAllPolls();
      expect(polls.length).to.equal(3);
    });

    it("Should return correct initial results", async function () {
      const options = ["Yes", "No", "Maybe"];
      await votingSystem.createPoll("Poll", "Desc", options, 3600, 3600);

      const results = await votingSystem.getResults(0);
      expect(results[0]).to.equal(0);
      expect(results[1]).to.equal(0);
      expect(results[2]).to.equal(0);
    });
  });

  describe("Poll Phase Tracking", function () {
    it("Should detect commit phase", async function () {
      const options = ["A", "B"];
      await votingSystem.createPoll("Poll", "Desc", options, 3600, 3600);

      const phase = await votingSystem.getPollPhase(0);
      expect(phase).to.equal("Commit");
    });

    it("Should fail if poll doesn't exist", async function () {
      await expect(votingSystem.getPoll(999)).to.be.revertedWith(
        "Poll does not exist"
      );
    });
  });

});