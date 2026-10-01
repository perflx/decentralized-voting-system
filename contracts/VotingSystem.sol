// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VotingSystem {
    
    struct Poll {
        uint256 id;
        address creator;
        string title;
        string description;
        string[] options;
        uint256 commitDeadline;
        uint256 revealDeadline;
        bool ended;
    }

    struct Commit {
        bytes32 hashedVote;
        bool exists;
    }

    struct Reveal {
        uint256 voteIndex;
        bool revealed;
    }

    Poll[] public polls;
    mapping(uint256 => mapping(address => Commit)) public commits;
    mapping(uint256 => mapping(address => Reveal)) public reveals;
    mapping(uint256 => mapping(uint256 => uint256)) public voteCount;

    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        string title,
        uint256 commitDeadline,
        uint256 revealDeadline
    );

    event CommitVote(
        uint256 indexed pollId,
        address indexed voter,
        bytes32 hashedVote
    );

    event RevealVote(
        uint256 indexed pollId,
        address indexed voter,
        uint256 voteIndex
    );

    event PollEnded(uint256 indexed pollId);

    function createPoll(
        string memory _title,
        string memory _description,
        string[] memory _options,
        uint256 _commitDuration,
        uint256 _revealDuration
    ) public {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_options.length >= 2, "Poll must have at least 2 options");
        require(_commitDuration > 0, "Commit duration must be > 0");
        require(_revealDuration > 0, "Reveal duration must be > 0");

        uint256 commitDeadline = block.timestamp + _commitDuration;
        uint256 revealDeadline = commitDeadline + _revealDuration;

        Poll memory newPoll = Poll({
            id: polls.length,
            creator: msg.sender,
            title: _title,
            description: _description,
            options: _options,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            ended: false
        });

        polls.push(newPoll);

        emit PollCreated(
            polls.length - 1,
            msg.sender,
            _title,
            commitDeadline,
            revealDeadline
        );
    }

    function commit(uint256 _pollId, bytes32 _hashedVote) public {
        require(_pollId < polls.length, "Poll does not exist");
        Poll storage poll = polls[_pollId];

        require(block.timestamp <= poll.commitDeadline, "Commit phase ended");
        require(!commits[_pollId][msg.sender].exists, "Already committed");
        require(_hashedVote != bytes32(0), "Invalid hash");

        commits[_pollId][msg.sender] = Commit({
            hashedVote: _hashedVote,
            exists: true
        });

        emit CommitVote(_pollId, msg.sender, _hashedVote);
    }

    function reveal(
        uint256 _pollId,
        uint256 _voteIndex,
        bytes32 _salt
    ) public {
        require(_pollId < polls.length, "Poll does not exist");
        Poll storage poll = polls[_pollId];

        require(block.timestamp > poll.commitDeadline, "Commit phase not ended");
        require(block.timestamp <= poll.revealDeadline, "Reveal phase ended");
        require(commits[_pollId][msg.sender].exists, "No commit found");
        require(!reveals[_pollId][msg.sender].revealed, "Already revealed");
        require(_voteIndex < poll.options.length, "Invalid option index");

        bytes32 computedHash = keccak256(abi.encodePacked(_voteIndex, _salt));
        require(
            computedHash == commits[_pollId][msg.sender].hashedVote,
            "Hash mismatch"
        );

        reveals[_pollId][msg.sender] = Reveal({
            voteIndex: _voteIndex,
            revealed: true
        });

        voteCount[_pollId][_voteIndex]++;

        emit RevealVote(_pollId, msg.sender, _voteIndex);
    }

    function getPoll(uint256 _pollId) public view returns (Poll memory) {
        require(_pollId < polls.length, "Poll does not exist");
        return polls[_pollId];
    }

    function getAllPolls() public view returns (Poll[] memory) {
        return polls;
    }

    function getResults(uint256 _pollId) public view returns (uint256[] memory) {
        require(_pollId < polls.length, "Poll does not exist");
        Poll storage poll = polls[_pollId];

        uint256[] memory results = new uint256[](poll.options.length);
        for (uint256 i = 0; i < poll.options.length; i++) {
            results[i] = voteCount[_pollId][i];
        }

        return results;
    }

    function hasCommitted(uint256 _pollId, address _voter) public view returns (bool) {
        return commits[_pollId][_voter].exists;
    }

    function hasRevealed(uint256 _pollId, address _voter) public view returns (bool) {
        return reveals[_pollId][_voter].revealed;
    }

    function getPollCount() public view returns (uint256) {
        return polls.length;
    }

    function getPollPhase(uint256 _pollId) public view returns (string memory) {
        require(_pollId < polls.length, "Poll does not exist");
        Poll storage poll = polls[_pollId];

        if (block.timestamp <= poll.commitDeadline) {
            return "Commit";
        } else if (block.timestamp <= poll.revealDeadline) {
            return "Reveal";
        } else {
            return "Ended";
        }
    }
} 