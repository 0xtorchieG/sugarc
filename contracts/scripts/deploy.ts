import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Sugarc = await ethers.getContractFactory("Sugarc");
  const sugarc = await Sugarc.deploy();
  await sugarc.waitForDeployment();

  console.log("Sugarc deployed to:", await sugarc.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
