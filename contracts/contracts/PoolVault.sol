// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PoolVault
 * @notice Arc liquidity hub with static risk pools for tokenized invoice factoring (Sugarc).
 *         LPs deposit USDC into pools; SMB invoices draw from pool liquidity.
 *         Pool IDs: 0 = Prime, 1 = Standard, 2 = HighYield.
 */
contract PoolVault is Ownable, ReentrancyGuard {
    /// @notice Number of static pools (0 = Prime, 1 = Standard, 2 = HighYield)
    uint8 public constant NUM_POOLS = 3;

    struct PoolInfo {
        uint256 totalDeposits;
        uint256 totalOutstanding;
    }

    IERC20 public immutable usdc;

    /// @notice poolId => PoolInfo
    mapping(uint8 => PoolInfo) public pools;

    /// @notice lp => poolId => amount
    mapping(address => mapping(uint8 => uint256)) public userDeposits;

    event LiquidityAdded(address indexed lp, uint8 indexed poolId, uint256 amount);

    error InvalidPoolId();
    error TransferFailed();

    constructor(address _usdc) Ownable(msg.sender) ReentrancyGuard() {
        require(_usdc != address(0), "PoolVault: zero USDC address");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Deposit USDC into a pool.
     * @param poolId 0 = Prime, 1 = Standard, 2 = HighYield
     * @param amount Amount of USDC (6 decimals) to deposit
     */
    function deposit(uint8 poolId, uint256 amount) external nonReentrant {
        if (poolId >= NUM_POOLS) revert InvalidPoolId();
        require(amount > 0, "PoolVault: zero amount");

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        userDeposits[msg.sender][poolId] += amount;
        pools[poolId].totalDeposits += amount;

        emit LiquidityAdded(msg.sender, poolId, amount);
    }

    /**
     * @notice Get pool state.
     * @param poolId 0 = Prime, 1 = Standard, 2 = HighYield
     * @return totalDeposits Total USDC deposited in the pool
     * @return totalOutstanding USDC currently allocated to invoices
     * @return availableLiquidity totalDeposits - totalOutstanding
     */
    function getPool(uint8 poolId)
        external
        view
        returns (uint256 totalDeposits, uint256 totalOutstanding, uint256 availableLiquidity)
    {
        if (poolId >= NUM_POOLS) revert InvalidPoolId();
        PoolInfo storage p = pools[poolId];
        totalDeposits = p.totalDeposits;
        totalOutstanding = p.totalOutstanding;
        availableLiquidity = totalDeposits > totalOutstanding
            ? totalDeposits - totalOutstanding
            : 0;
    }

    /**
     * @notice Get an LP's deposit balance in a pool.
     */
    function getUserDeposits(address user, uint8 poolId) external view returns (uint256) {
        if (poolId >= NUM_POOLS) revert InvalidPoolId();
        return userDeposits[user][poolId];
    }

    /**
     * @notice Set totalOutstanding for a pool (admin / future invoice contract).
     *         Used when invoices draw from or repay to the pool.
     */
    function setTotalOutstanding(uint8 poolId, uint256 value) external onlyOwner nonReentrant {
        if (poolId >= NUM_POOLS) revert InvalidPoolId();
        require(value <= pools[poolId].totalDeposits, "PoolVault: outstanding > deposits");
        pools[poolId].totalOutstanding = value;
    }
}
