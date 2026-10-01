# Decentralized Voting System

A simple voting dApp on Ethereum that uses a **commit-reveal** scheme, so nobody can see the votes while the voting is still going.

Made as a university project (Web3). Smart contract is written in Solidity and tested with Hardhat, frontend is React + ethers.js + MetaMask.

## How it works

Every poll has two phases:

1. **Commit phase** – the user picks an option, the app generates a random salt and sends only `keccak256(option, salt)` to the contract. Nobody can tell what you voted for.
2. **Reveal phase** – after the commit phase is over, the user sends the option and the salt. The contract hashes them again, compares with the stored hash and, if it matches, counts the vote.

After the reveal deadline the poll is over and the results are final.

Anyone can create a poll: title, description, options and the duration of both phases (in seconds).

## Tech stack

- Solidity `^0.8.24`
- Hardhat (compile, test, local node, deploy)
- React (create-react-app)
- ethers.js v6
- MetaMask

## Project structure

```
contracts/   VotingSystem.sol
scripts/     deploy.js
test/        voting.test.js
frontend/    React app (VotingApp.jsx is the main component)
```

## How to run

You need Node.js and MetaMask installed.

```bash
# 1. install dependencies
npm install
cd frontend && npm install && cd ..

# 2. start a local blockchain (keep this terminal open)
npx hardhat node

# 3. in a new terminal: deploy the contract
npx hardhat run scripts/deploy.js --network localhost

# 4. start the frontend
cd frontend
npm start
```

Then in MetaMask add the local network (RPC `http://127.0.0.1:8545`, chain ID `31337`) and import one of the private keys that `hardhat node` prints in the console. These are public test keys, never use them for real money.

The contract address is hardcoded in `frontend/src/VotingApp.jsx`. On a fresh local node the first deploy always gets `0x5FbDB2315678afecb367f032d93F642f64180aa3`, so it should work out of the box. If you deploy somewhere else, change the address there.

If you recompile the contract, don't forget to update the ABI in `frontend/src/contracts/VotingSystem.json`.

### Tests

```bash
npx hardhat test
```
