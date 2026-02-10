const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying CredentialRegistry to Sepolia...");

  const CredentialRegistry = await hre.ethers.getContractFactory("CredentialRegistry");
  const contract = await CredentialRegistry.deploy();

  await contract.deployed();

  console.log("✅ CredentialRegistry deployed to:", contract.address);
  console.log("\n📝 Save this address to your .env file:");
  console.log(`CONTRACT_ADDRESS=${contract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
