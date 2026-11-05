// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVotes {
    function getPastVotes(address account, uint256 timepoint) external view returns (uint256);
    function getPastTotalSupply(uint256 timepoint) external view returns (uint256);
}

contract SulyozottSzavazas {
    struct Poll {
        string question;
        string[] options;
        uint256[] counts;
        uint256 snapshot;
        uint256 deadline;
        uint256 voterCount;
    }

    struct Ballot {
        bool voted;
        bool changed;
        uint256 option;
        uint256 weight;
    }

    IVotes public immutable token;
    address public owner;
    Poll[] private polls;
    mapping(uint256 => mapping(address => Ballot)) public ballots;

    event PollCreated(uint256 indexed pollId, string question, uint256 snapshot, uint256 deadline);
    event Voted(uint256 indexed pollId, address indexed voter, uint256 option, uint256 weight);
    event VoteChanged(
        uint256 indexed pollId,
        address indexed voter,
        uint256 oldOption,
        uint256 newOption,
        uint256 weight
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Csak a tanar indithat szavazast");
        _;
    }

    modifier openPoll(uint256 pollId) {
        require(pollId < polls.length, "Nincs ilyen szavazas");
        require(block.timestamp < polls[pollId].deadline, "A szavazas lezarult");
        _;
    }

    constructor() {
        token = IVotes(0x01438AC36474DCCAc97d44F648bDa3c113E32Fbd); // SzavazoToken (IGOV) a Base-en
        owner = msg.sender;
    }

    function createPoll(
        string calldata question,
        string[] calldata options,
        uint256 durationMinutes
    ) external onlyOwner returns (uint256 pollId) {
        require(bytes(question).length > 0, "Ures a kerdes");
        require(bytes(question).length <= 200, "Tul hosszu a kerdes");
        require(options.length >= 2, "Legalabb 2 opcio kell");
        require(options.length <= 8, "Legfeljebb 8 opcio lehet");
        require(durationMinutes >= 1, "Legalabb 1 perc");
        require(durationMinutes <= 43200, "Legfeljebb 30 nap");

        pollId = polls.length;
        Poll storage p = polls.push();
        p.question = question;
        p.snapshot = block.number - 1;
        p.deadline = block.timestamp + durationMinutes * 1 minutes;

        for (uint256 i = 0; i < options.length; i++) {
            require(bytes(options[i]).length > 0, "Ures opcio");
            require(bytes(options[i]).length <= 64, "Tul hosszu opcio");
            p.options.push(options[i]);
            p.counts.push(0);
        }

        emit PollCreated(pollId, question, p.snapshot, p.deadline);
    }

    function votingPower(uint256 pollId, address account) public view returns (uint256) {
        require(pollId < polls.length, "Nincs ilyen szavazas");
        return token.getPastVotes(account, polls[pollId].snapshot);
    }

    function vote(uint256 pollId, uint256 option) external openPoll(pollId) {
        Poll storage p = polls[pollId];
        Ballot storage b = ballots[pollId][msg.sender];
        require(!b.voted, "Mar szavaztal");
        require(option < p.options.length, "Nincs ilyen opcio");

        uint256 weight = token.getPastVotes(msg.sender, p.snapshot);
        require(weight > 0, "Nem volt tokened a szavazas inditasakor");

        b.voted = true;
        b.option = option;
        b.weight = weight;
        p.counts[option] += weight;
        p.voterCount += 1;

        emit Voted(pollId, msg.sender, option, weight);
    }

    function changeVote(uint256 pollId, uint256 newOption) external openPoll(pollId) {
        Poll storage p = polls[pollId];
        Ballot storage b = ballots[pollId][msg.sender];
        require(b.voted, "Meg nem szavaztal");
        require(!b.changed, "Mar modositottal egyszer");
        require(newOption < p.options.length, "Nincs ilyen opcio");
        require(newOption != b.option, "Mar erre szavaztal");

        uint256 oldOption = b.option;
        p.counts[oldOption] -= b.weight;
        p.counts[newOption] += b.weight;
        b.option = newOption;
        b.changed = true;

        emit VoteChanged(pollId, msg.sender, oldOption, newOption, b.weight);
    }

    function pollCount() external view returns (uint256) {
        return polls.length;
    }

    function getPoll(uint256 pollId)
        external
        view
        returns (
            string memory question,
            string[] memory options,
            uint256[] memory counts,
            uint256 snapshot,
            uint256 deadline,
            uint256 voterCount
        )
    {
        require(pollId < polls.length, "Nincs ilyen szavazas");
        Poll storage p = polls[pollId];
        return (p.question, p.options, p.counts, p.snapshot, p.deadline, p.voterCount);
    }
}
