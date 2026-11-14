const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const Voting = await hre.ethers.getContractFactory("Voting");

  // Nama kandidat default (boleh bebas)
  const candidateNames = ["Royyan", "Maurin", "ChatGPT"];
  const votingDurationSeconds = 7 * 24 * 60 * 60;

  console.log("Deploying contract...");
  const voting = await Voting.deploy(candidateNames, votingDurationSeconds);

  const receipt = await (await voting.deployed()).deployTransaction.wait();

  const contractAddress = voting.address;
  const frontendDir = path.join(__dirname, "..", "voting-frontend", "src");
  const configPath = path.join(frontendDir, "config.js");
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "Voting.sol", "Voting.json");
  const frontendAbiPath = path.join(frontendDir, "abi", "Voting.json");

  fs.writeFileSync(
    configPath,
    `export const CONTRACT_ADDRESS = "${contractAddress}";\nexport const DEPLOYMENT_BLOCK = ${receipt.blockNumber};\n`,
    "utf8"
  );
  fs.copyFileSync(artifactPath, frontendAbiPath);

  console.log("Voting deployed at:", contractAddress);
  console.log("Updated frontend contract address and ABI.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
