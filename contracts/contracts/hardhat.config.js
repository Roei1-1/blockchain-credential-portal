require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

module.exports = {
  solidity: "0.8.0",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY]
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test"
  }
};
