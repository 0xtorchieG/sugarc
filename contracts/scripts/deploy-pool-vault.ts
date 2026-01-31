import { ethers } from "hardhat";
import { ARC_TESTNET_USDC } from "./constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying SugarcPoolVault with:", deployer.address, "network:", network.name, "chainId:", network.chainId);

  let usdcAddress = process.env.USDC_ADDRESS;

  if (!usdcAddress) {
    // Arc Testnet: use native USDC ERC-20 interface (6 decimals)
    if (Number(network.chainId) === 5042002) {
      usdcAddress = ARC_TESTNET_USDC;
      console.log("Arc Testnet detected; using native USDC ERC-20 at:", usdcAddress);
    } else {
      throw new Error("USDC_ADDRESS not set. Set USDC_ADDRESS for this network or deploy to Arc Testnet (chainId 5042002).");
    }
  } else {
    console.log("Using USDC at:", usdcAddress);
  }

  const SugarcPoolVault = await ethers.getContractFactory("SugarcPoolVault");
  const vault = await SugarcPoolVault.deploy(usdcAddress);
  await vault.waitForDeployment();

  console.log("SugarcPoolVault deployed to:", await vault.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
