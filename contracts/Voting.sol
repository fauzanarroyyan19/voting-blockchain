// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    address public owner;
    uint256 public immutable votingStartTime;
    uint256 public immutable votingEndTime;
    uint256 public totalVotes;
    mapping(address => bool) public hasVoted;
    Candidate[] public candidates;

    event CandidateAdded(uint256 indexed candidateIndex, string name);
    event VoteCast(address indexed voter, uint256 indexed candidateIndex, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can do this");
        _;
    }

    constructor(string[] memory _candidateNames, uint256 _votingDuration) {
        require(_candidateNames.length > 0, "Add at least one candidate");
        require(_votingDuration > 0, "Voting duration must be positive");

        owner = msg.sender;
        votingStartTime = block.timestamp;
        votingEndTime = block.timestamp + _votingDuration;

        for (uint256 i = 0; i < _candidateNames.length; i++) {
            _addCandidate(_candidateNames[i]);
        }
    }

    function vote(uint256 _candidateIndex) external {
        require(block.timestamp >= votingStartTime, "Voting has not started");
        require(block.timestamp < votingEndTime, "Voting has ended");
        require(!hasVoted[msg.sender], "You have already voted");
        require(_candidateIndex < candidates.length, "Invalid candidate");

        hasVoted[msg.sender] = true;
        candidates[_candidateIndex].voteCount++;
        totalVotes++;

        emit VoteCast(msg.sender, _candidateIndex, block.timestamp);
    }

    function addCandidate(string calldata _name) external onlyOwner {
        require(block.timestamp < votingEndTime, "Voting has ended");
        require(totalVotes == 0, "Candidates are locked after the first vote");
        _addCandidate(_name);
    }

    function getCandidates() external view returns (Candidate[] memory) {
        return candidates;
    }

    function totalCandidates() external view returns (uint256) {
        return candidates.length;
    }

    function votingActive() external view returns (bool) {
        return block.timestamp >= votingStartTime && block.timestamp < votingEndTime;
    }

    function _addCandidate(string memory _name) private {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        candidates.push(Candidate({name: _name, voteCount: 0}));
        emit CandidateAdded(candidates.length - 1, _name);
    }
}
