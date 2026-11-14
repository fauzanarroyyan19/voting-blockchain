<<<<<<< HEAD
# Voting Blockchain

A local blockchain voting demo built with Solidity, Hardhat, React, Vite, Ethers.js, and MetaMask.

## Features

- Connect a MetaMask wallet and vote once per wallet address.
- View candidates, vote totals, and vote percentages.
- View total voters and the number of other voters in User mode.
- Use the contract owner's wallet to open Admin mode, add candidates before the first vote, and monitor voter activity.
- See voter activity from smart contract events and a daily voter chart.
- Voting stays open for seven days after deployment.

## Requirements

- Node.js and npm
- MetaMask browser extension

## Run locally

Open three terminals in the project folder.

### 1. Start the local blockchain

```powershell
npx.cmd hardhat node
```

Keep this terminal open. Hardhat Local uses RPC `http://127.0.0.1:8545` and Chain ID `31337`.

### 2. Compile and deploy

```powershell
npx.cmd hardhat compile
npx.cmd hardhat run scripts/deploy.js --network localhost
```

The deploy script writes the new contract address to `voting-frontend/src/config.js` and copies the latest ABI to the frontend. Deploy again whenever the local node is restarted.

### 3. Start the frontend

```powershell
cd voting-frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173/`.

## MetaMask local network

Add or select a custom network with these settings:

| Setting | Value |
| --- | --- |
| Network name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

For local testing, import a Hardhat development account into MetaMask. Hardhat's sample accounts and keys are public test credentials; never use them on a public network or with real funds.

## Voting rules

- Each wallet address can vote once.
- Only the contract owner can add candidates, and only before the first vote.
- Votes and voter addresses are public on-chain.
- Restarting the local Hardhat node resets its state. Redeploy the contract afterward; previous local votes are not carried over.

This repository is configured for local development. A public portfolio deployment requires a public test network, a deployed contract on that network, and a frontend configured for the same chain.
=======
# voting-blockchain
>>>>>>> d021a65be6919340b4819f12df3f1caafbf92a7b
