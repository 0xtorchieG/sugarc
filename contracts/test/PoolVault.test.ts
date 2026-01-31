import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { PoolVault, MintableERC20 } from "../typechain-types";

describe("PoolVault", function () {
  const POOL_PRIME = 0;
  const POOL_STANDARD = 1;
  const POOL_HIGH_YIELD = 2;
  const USDC_DECIMALS = 6;

  async function deployPoolVaultFixture() {
    const [owner, lp1, lp2, smb] = await ethers.getSigners();

    const MintableERC20Factory = await ethers.getContractFactory("MintableERC20");
    const usdc = (await MintableERC20Factory.deploy("USD Coin", "USDC", USDC_DECIMALS)) as unknown as MintableERC20;
    await usdc.waitForDeployment();

    const mintAmount = ethers.parseUnits("1000000", USDC_DECIMALS);
    await usdc.mint(lp1.address, mintAmount);
    await usdc.mint(lp2.address, mintAmount);

    const PoolVaultFactory = await ethers.getContractFactory("PoolVault");
    const vault = (await PoolVaultFactory.deploy(await usdc.getAddress())) as unknown as PoolVault;
    await vault.waitForDeployment();

    return { vault, usdc, owner, lp1, lp2, smb };
  }

  describe("deployment", function () {
    it("should set USDC address and NUM_POOLS = 3", async function () {
      const { vault, usdc } = await loadFixture(deployPoolVaultFixture);
      expect(await vault.usdc()).to.equal(await usdc.getAddress());
      expect(await vault.NUM_POOLS()).to.equal(3);
    });

    it("should revert on zero USDC address", async function () {
      const PoolVault = await ethers.getContractFactory("PoolVault");
      await expect(PoolVault.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        "PoolVault: zero USDC address"
      );
    });
  });

  describe("deposit", function () {
    it("should accept deposit and update pool and user balances", async function () {
      const { vault, usdc, lp1 } = await loadFixture(deployPoolVaultFixture);
      const amount = ethers.parseUnits("10000", USDC_DECIMALS);

      await usdc.connect(lp1).approve(await vault.getAddress(), amount);
      await expect(vault.connect(lp1).deposit(POOL_PRIME, amount))
        .to.emit(vault, "LiquidityAdded")
        .withArgs(lp1.address, POOL_PRIME, amount);

      expect(await vault.getUserDeposits(lp1.address, POOL_PRIME)).to.equal(amount);
      const [totalDeposits, totalOutstanding, availableLiquidity] = await vault.getPool(POOL_PRIME);
      expect(totalDeposits).to.equal(amount);
      expect(totalOutstanding).to.equal(0);
      expect(availableLiquidity).to.equal(amount);
    });

    it("should accumulate multiple deposits from same LP", async function () {
      const { vault, usdc, lp1 } = await loadFixture(deployPoolVaultFixture);
      const a1 = ethers.parseUnits("5000", USDC_DECIMALS);
      const a2 = ethers.parseUnits("3000", USDC_DECIMALS);

      await usdc.connect(lp1).approve(await vault.getAddress(), a1 + a2);
      await vault.connect(lp1).deposit(POOL_STANDARD, a1);
      await vault.connect(lp1).deposit(POOL_STANDARD, a2);

      expect(await vault.getUserDeposits(lp1.address, POOL_STANDARD)).to.equal(a1 + a2);
      const [totalDeposits] = await vault.getPool(POOL_STANDARD);
      expect(totalDeposits).to.equal(a1 + a2);
    });

    it("should track deposits per pool independently", async function () {
      const { vault, usdc, lp1 } = await loadFixture(deployPoolVaultFixture);
      const primeAmount = ethers.parseUnits("10000", USDC_DECIMALS);
      const standardAmount = ethers.parseUnits("20000", USDC_DECIMALS);
      const highYieldAmount = ethers.parseUnits("5000", USDC_DECIMALS);

      await usdc.connect(lp1).approve(await vault.getAddress(), primeAmount + standardAmount + highYieldAmount);
      await vault.connect(lp1).deposit(POOL_PRIME, primeAmount);
      await vault.connect(lp1).deposit(POOL_STANDARD, standardAmount);
      await vault.connect(lp1).deposit(POOL_HIGH_YIELD, highYieldAmount);

      expect(await vault.getUserDeposits(lp1.address, POOL_PRIME)).to.equal(primeAmount);
      expect(await vault.getUserDeposits(lp1.address, POOL_STANDARD)).to.equal(standardAmount);
      expect(await vault.getUserDeposits(lp1.address, POOL_HIGH_YIELD)).to.equal(highYieldAmount);

      const [p0] = await vault.getPool(POOL_PRIME);
      const [p1] = await vault.getPool(POOL_STANDARD);
      const [p2] = await vault.getPool(POOL_HIGH_YIELD);
      expect(p0).to.equal(primeAmount);
      expect(p1).to.equal(standardAmount);
      expect(p2).to.equal(highYieldAmount);
    });

    it("should revert on invalid poolId", async function () {
      const { vault, usdc, lp1 } = await loadFixture(deployPoolVaultFixture);
      const amount = ethers.parseUnits("1000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), amount);
      await expect(vault.connect(lp1).deposit(3, amount)).to.be.revertedWithCustomError(
        vault,
        "InvalidPoolId"
      );
    });

    it("should revert on zero amount", async function () {
      const { vault, lp1 } = await loadFixture(deployPoolVaultFixture);
      await expect(vault.connect(lp1).deposit(POOL_PRIME, 0)).to.be.revertedWith(
        "PoolVault: zero amount"
      );
    });

    it("should pull USDC from sender and hold in contract", async function () {
      const { vault, usdc, lp1 } = await loadFixture(deployPoolVaultFixture);
      const amount = ethers.parseUnits("5000", USDC_DECIMALS);
      const vaultAddress = await vault.getAddress();
      const lp1BalanceBefore = await usdc.balanceOf(lp1.address);
      const vaultBalanceBefore = await usdc.balanceOf(vaultAddress);

      await usdc.connect(lp1).approve(vaultAddress, amount);
      await vault.connect(lp1).deposit(POOL_HIGH_YIELD, amount);

      expect(await usdc.balanceOf(lp1.address)).to.equal(lp1BalanceBefore - amount);
      expect(await usdc.balanceOf(vaultAddress)).to.equal(vaultBalanceBefore + amount);
    });
  });

  describe("getPool", function () {
    it("should return availableLiquidity as totalDeposits - totalOutstanding", async function () {
      const { vault, usdc, lp1, owner } = await loadFixture(deployPoolVaultFixture);
      const amount = ethers.parseUnits("10000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), amount);
      await vault.connect(lp1).deposit(POOL_PRIME, amount);

      let [totalDeposits, totalOutstanding, availableLiquidity] = await vault.getPool(POOL_PRIME);
      expect(totalDeposits).to.equal(amount);
      expect(totalOutstanding).to.equal(0);
      expect(availableLiquidity).to.equal(amount);

      const outstanding = ethers.parseUnits("3000", USDC_DECIMALS);
      await vault.connect(owner).setTotalOutstanding(POOL_PRIME, outstanding);

      [totalDeposits, totalOutstanding, availableLiquidity] = await vault.getPool(POOL_PRIME);
      expect(totalDeposits).to.equal(amount);
      expect(totalOutstanding).to.equal(outstanding);
      expect(availableLiquidity).to.equal(amount - outstanding);
    });

    it("should revert getPool on invalid poolId", async function () {
      const { vault } = await loadFixture(deployPoolVaultFixture);
      await expect(vault.getPool(3)).to.be.revertedWithCustomError(vault, "InvalidPoolId");
    });
  });

  describe("getUserDeposits", function () {
    it("should return 0 for non-depositor", async function () {
      const { vault, lp1 } = await loadFixture(deployPoolVaultFixture);
      expect(await vault.getUserDeposits(lp1.address, POOL_PRIME)).to.equal(0);
    });

    it("should revert getUserDeposits on invalid poolId", async function () {
      const { vault, lp1 } = await loadFixture(deployPoolVaultFixture);
      await expect(vault.getUserDeposits(lp1.address, 3)).to.be.revertedWithCustomError(
        vault,
        "InvalidPoolId"
      );
    });
  });

  describe("setTotalOutstanding (owner)", function () {
    it("should allow owner to set totalOutstanding", async function () {
      const { vault, usdc, lp1, owner } = await loadFixture(deployPoolVaultFixture);
      const amount = ethers.parseUnits("10000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), amount);
      await vault.connect(lp1).deposit(POOL_STANDARD, amount);

      const outstanding = ethers.parseUnits("2000", USDC_DECIMALS);
      await vault.connect(owner).setTotalOutstanding(POOL_STANDARD, outstanding);
      const [, totalOutstanding] = await vault.getPool(POOL_STANDARD);
      expect(totalOutstanding).to.equal(outstanding);
    });

    it("should revert when outstanding > totalDeposits", async function () {
      const { vault, usdc, lp1, owner } = await loadFixture(deployPoolVaultFixture);
      const amount = ethers.parseUnits("1000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), amount);
      await vault.connect(lp1).deposit(POOL_PRIME, amount);

      const tooMuch = amount + 1n;
      await expect(
        vault.connect(owner).setTotalOutstanding(POOL_PRIME, tooMuch)
      ).to.be.revertedWith("PoolVault: outstanding > deposits");
    });

    it("should revert when non-owner sets totalOutstanding", async function () {
      const { vault, lp1 } = await loadFixture(deployPoolVaultFixture);
      await expect(
        vault.connect(lp1).setTotalOutstanding(POOL_PRIME, 1000)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("fundInvoice", function () {
    const faceAmount = ethers.parseUnits("10000", USDC_DECIMALS);
    const advanceAmount = ethers.parseUnits("8000", USDC_DECIMALS);
    const feeBps = 250; // 2.5%
    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days
    const refHash = ethers.keccak256(ethers.toUtf8Bytes("INV-001"));

    it("should fund invoice: transfer USDC to SMB, store invoice, update pool accounting", async function () {
      const { vault, usdc, lp1, owner, smb } = await loadFixture(deployPoolVaultFixture);
      const depositAmount = ethers.parseUnits("20000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(lp1).deposit(POOL_PRIME, depositAmount);

      const smbBalanceBefore = await usdc.balanceOf(smb.address);
      const vaultBalanceBefore = await usdc.balanceOf(await vault.getAddress());

      await expect(
        vault.connect(owner).fundInvoice(
          POOL_PRIME,
          smb.address,
          faceAmount,
          advanceAmount,
          feeBps,
          dueDate,
          refHash
        )
      )
        .to.emit(vault, "InvoiceFunded")
        .withArgs(0, POOL_PRIME, smb.address, advanceAmount, faceAmount, dueDate, feeBps, refHash);

      expect(await usdc.balanceOf(smb.address)).to.equal(smbBalanceBefore + advanceAmount);
      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(vaultBalanceBefore - advanceAmount);

      const [totalDeposits, totalOutstanding, availableLiquidity] = await vault.getPool(POOL_PRIME);
      expect(totalDeposits).to.equal(depositAmount);
      expect(totalOutstanding).to.equal(advanceAmount);
      expect(availableLiquidity).to.equal(depositAmount - advanceAmount);

      const inv = await vault.getInvoice(0);
      expect(inv.poolId).to.equal(POOL_PRIME);
      expect(inv.smb).to.equal(smb.address);
      expect(inv.faceAmount).to.equal(faceAmount);
      expect(inv.advanceAmount).to.equal(advanceAmount);
      expect(inv.feeBps).to.equal(feeBps);
      expect(inv.dueDate).to.equal(dueDate);
      expect(inv.status).to.equal(0); // Funded
      expect(inv.refHash).to.equal(refHash);

      expect(await vault.getInvoiceIdByRefHash(refHash)).to.equal(0);
      expect(await vault.nextInvoiceId()).to.equal(1);
    });

    it("should revert when available liquidity < advanceAmount", async function () {
      const { vault, usdc, lp1, owner, smb } = await loadFixture(deployPoolVaultFixture);
      const depositAmount = ethers.parseUnits("5000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(lp1).deposit(POOL_STANDARD, depositAmount);

      const advanceMoreThanLiquidity = ethers.parseUnits("6000", USDC_DECIMALS);
      await expect(
        vault.connect(owner).fundInvoice(
          POOL_STANDARD,
          smb.address,
          faceAmount,
          advanceMoreThanLiquidity,
          feeBps,
          dueDate,
          refHash
        )
      ).to.be.revertedWithCustomError(vault, "InsufficientLiquidity");
    });

    it("should revert when non-owner calls fundInvoice", async function () {
      const { vault, usdc, lp1, smb } = await loadFixture(deployPoolVaultFixture);
      await usdc.connect(lp1).approve(await vault.getAddress(), advanceAmount);
      await vault.connect(lp1).deposit(POOL_PRIME, advanceAmount);

      await expect(
        vault.connect(lp1).fundInvoice(
          POOL_PRIME,
          smb.address,
          faceAmount,
          advanceAmount,
          feeBps,
          dueDate,
          refHash
        )
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("getInvoiceIdByRefHash returns type(uint256).max when not found", async function () {
      const { vault } = await loadFixture(deployPoolVaultFixture);
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
      expect(await vault.getInvoiceIdByRefHash(unknownHash)).to.equal(2n ** 256n - 1n);
    });
  });

  describe("repayInvoice", function () {
    const faceAmount = ethers.parseUnits("10000", USDC_DECIMALS);
    const advanceAmount = ethers.parseUnits("8000", USDC_DECIMALS);
    const feeBps = 250;
    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const refHash = ethers.keccak256(ethers.toUtf8Bytes("INV-REPAY"));

    it("partial repayment keeps invoice Funded and does not reduce totalOutstanding", async function () {
      const { vault, usdc, lp1, owner, smb } = await loadFixture(deployPoolVaultFixture);
      const depositAmount = ethers.parseUnits("20000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(lp1).deposit(POOL_PRIME, depositAmount);
      await vault.connect(owner).fundInvoice(
        POOL_PRIME,
        smb.address,
        faceAmount,
        advanceAmount,
        feeBps,
        dueDate,
        refHash
      );

      const partialAmount = ethers.parseUnits("3000", USDC_DECIMALS);
      await usdc.connect(smb).approve(await vault.getAddress(), partialAmount);
      await expect(vault.connect(smb).repayInvoice(0, partialAmount))
        .to.emit(vault, "InvoiceRepaid")
        .withArgs(0, POOL_PRIME, smb.address, partialAmount, false);

      const inv = await vault.getInvoice(0);
      expect(inv.repaidAmount).to.equal(partialAmount);
      expect(inv.status).to.equal(0); // Funded

      const [, totalOutstanding] = await vault.getPool(POOL_PRIME);
      expect(totalOutstanding).to.equal(advanceAmount);

      const vaultBalance = await usdc.balanceOf(await vault.getAddress());
      expect(vaultBalance).to.equal(depositAmount - advanceAmount + partialAmount);
    });

    it("full repayment marks invoice Repaid and reduces pool totalOutstanding", async function () {
      const { vault, usdc, lp1, owner, smb } = await loadFixture(deployPoolVaultFixture);
      const depositAmount = ethers.parseUnits("20000", USDC_DECIMALS);
      await usdc.connect(lp1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(lp1).deposit(POOL_PRIME, depositAmount);
      await vault.connect(owner).fundInvoice(
        POOL_PRIME,
        smb.address,
        faceAmount,
        advanceAmount,
        feeBps,
        dueDate,
        refHash
      );
      // SMB has advanceAmount; mint extra so they can repay full faceAmount
      const extraNeeded = faceAmount - advanceAmount;
      await usdc.mint(smb.address, extraNeeded);

      await usdc.connect(smb).approve(await vault.getAddress(), faceAmount);
      await expect(vault.connect(smb).repayInvoice(0, faceAmount))
        .to.emit(vault, "InvoiceRepaid")
        .withArgs(0, POOL_PRIME, smb.address, faceAmount, true)
        .to.emit(vault, "PoolLiquidityIncreased");

      const inv = await vault.getInvoice(0);
      expect(inv.repaidAmount).to.equal(faceAmount);
      expect(inv.status).to.equal(1); // Repaid

      const [totalDeposits, totalOutstanding, availableLiquidity] = await vault.getPool(POOL_PRIME);
      expect(totalDeposits).to.equal(depositAmount);
      expect(totalOutstanding).to.equal(0); // advance released on full repay
      expect(availableLiquidity).to.equal(depositAmount);

      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(
        depositAmount - advanceAmount + faceAmount
      );
    });

    it("repayInvoice reverts when invoice not Funded", async function () {
      const { vault, usdc, smb } = await loadFixture(deployPoolVaultFixture);
      await usdc.connect(smb).approve(await vault.getAddress(), faceAmount);
      await expect(vault.connect(smb).repayInvoice(999, faceAmount)).to.be.revertedWithCustomError(
        vault,
        "InvoiceNotFunded"
      );
    });

    it("repayInvoice reverts when invoice already Repaid", async function () {
      const { vault, usdc, lp1, owner, smb } = await loadFixture(deployPoolVaultFixture);
      await usdc.connect(lp1).approve(await vault.getAddress(), advanceAmount);
      await vault.connect(lp1).deposit(POOL_PRIME, advanceAmount);
      await vault.connect(owner).fundInvoice(
        POOL_PRIME,
        smb.address,
        faceAmount,
        advanceAmount,
        feeBps,
        dueDate,
        refHash
      );
      await usdc.mint(smb.address, faceAmount - advanceAmount);
      await usdc.connect(smb).approve(await vault.getAddress(), faceAmount);
      await vault.connect(smb).repayInvoice(0, faceAmount);

      await usdc.connect(smb).approve(await vault.getAddress(), 1n);
      await expect(vault.connect(smb).repayInvoice(0, 1n)).to.be.revertedWithCustomError(
        vault,
        "InvoiceNotFunded"
      );
    });
  });
});
