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

    /// @notice Invoice status for registry
    enum InvoiceStatus {
        Funded,
        Repaid
    }

    /// @notice Onchain invoice record (funded from a pool)
    struct Invoice {
        uint256 invoiceId;
        uint8 poolId;
        address smb;
        uint256 faceAmount;
        uint256 advanceAmount;
        uint256 repaidAmount;
        uint16 feeBps;
        uint256 dueDate;
        InvoiceStatus status;
        bytes32 refHash;
    }

    /// @notice invoiceId => Invoice
    mapping(uint256 => Invoice) public invoices;
    uint256 public nextInvoiceId;
    /// @notice refHash (offchain invoice record hash) => invoiceId + 1 (0 = not found)
    mapping(bytes32 => uint256) private _refHashToInvoiceId;

    event LiquidityAdded(address indexed lp, uint8 indexed poolId, uint256 amount);
    event InvoiceFunded(
        uint256 indexed invoiceId,
        uint8 indexed poolId,
        address indexed smb,
        uint256 advanceAmount,
        uint256 faceAmount,
        uint256 dueDate,
        uint16 feeBps,
        bytes32 refHash
    );
    event InvoiceRepaid(
        uint256 indexed invoiceId,
        uint8 indexed poolId,
        address indexed payer,
        uint256 amount,
        bool fullyRepaid
    );
    event PoolLiquidityIncreased(uint8 indexed poolId, uint256 amount, uint256 newAvailableLiquidity);

    error InvalidPoolId();
    error TransferFailed();
    error InsufficientLiquidity();
    error InvoiceNotFunded();

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

    /**
     * @notice Fund an SMB invoice from a pool: transfer USDC to SMB, record invoice onchain.
     *         Admin-only for MVP (underwriting offchain).
     * @param poolId Pool to draw from (0 = Prime, 1 = Standard, 2 = HighYield)
     * @param smb SMB wallet to receive advanceAmount
     * @param faceAmount Invoice face value (USDC 6 decimals)
     * @param advanceAmount Amount to advance to SMB (USDC 6 decimals)
     * @param feeBps Fee in basis points
     * @param dueDate Invoice due date (timestamp)
     * @param refHash Hash of offchain invoice record
     */
    function fundInvoice(
        uint8 poolId,
        address smb,
        uint256 faceAmount,
        uint256 advanceAmount,
        uint16 feeBps,
        uint256 dueDate,
        bytes32 refHash
    ) external onlyOwner nonReentrant {
        if (poolId >= NUM_POOLS) revert InvalidPoolId();
        require(smb != address(0), "PoolVault: zero SMB");
        require(advanceAmount > 0, "PoolVault: zero advance");

        PoolInfo storage p = pools[poolId];
        uint256 available = p.totalDeposits > p.totalOutstanding
            ? p.totalDeposits - p.totalOutstanding
            : 0;
        if (available < advanceAmount) revert InsufficientLiquidity();

        uint256 invoiceId = nextInvoiceId++;
        _refHashToInvoiceId[refHash] = invoiceId + 1;
        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            poolId: poolId,
            smb: smb,
            faceAmount: faceAmount,
            advanceAmount: advanceAmount,
            repaidAmount: 0,
            feeBps: feeBps,
            dueDate: dueDate,
            status: InvoiceStatus.Funded,
            refHash: refHash
        });

        p.totalOutstanding += advanceAmount;

        bool ok = usdc.transfer(smb, advanceAmount);
        if (!ok) revert TransferFailed();

        emit InvoiceFunded(invoiceId, poolId, smb, advanceAmount, faceAmount, dueDate, feeBps, refHash);
    }

    /**
     * @notice Repay an invoice: transfer USDC from payer into vault, update repayment state.
     *         When repaidAmount >= faceAmount, invoice is marked Repaid and pool totalOutstanding is reduced.
     *         LPs benefit via pool-level accounting; no per-invoice LP payout.
     */
    function repayInvoice(uint256 invoiceId, uint256 amount) external nonReentrant {
        require(amount > 0, "PoolVault: zero amount");
        Invoice storage inv = invoices[invoiceId];
        if (inv.smb == address(0)) revert InvoiceNotFunded();
        if (inv.status != InvoiceStatus.Funded) revert InvoiceNotFunded();

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        inv.repaidAmount += amount;
        bool fullyRepaid = inv.repaidAmount >= inv.faceAmount;
        if (fullyRepaid) {
            inv.status = InvoiceStatus.Repaid;
            // Release the advance (what we drew from the pool) back to available liquidity
            pools[inv.poolId].totalOutstanding -= inv.advanceAmount;
            uint256 newAvailable =
                pools[inv.poolId].totalDeposits - pools[inv.poolId].totalOutstanding;
            emit PoolLiquidityIncreased(inv.poolId, inv.advanceAmount, newAvailable);
        }

        emit InvoiceRepaid(invoiceId, inv.poolId, msg.sender, amount, fullyRepaid);
    }

    /**
     * @notice Get full invoice by id.
     */
    function getInvoice(uint256 invoiceId)
        external
        view
        returns (
            uint8 poolId,
            address smb,
            uint256 faceAmount,
            uint256 advanceAmount,
            uint256 repaidAmount,
            uint16 feeBps,
            uint256 dueDate,
            InvoiceStatus status,
            bytes32 refHash
        )
    {
        Invoice storage inv = invoices[invoiceId];
        return (
            inv.poolId,
            inv.smb,
            inv.faceAmount,
            inv.advanceAmount,
            inv.repaidAmount,
            inv.feeBps,
            inv.dueDate,
            inv.status,
            inv.refHash
        );
    }

    /**
     * @notice Get invoiceId by refHash. Returns type(uint256).max if not found.
     */
    function getInvoiceIdByRefHash(bytes32 refHash) external view returns (uint256) {
        uint256 stored = _refHashToInvoiceId[refHash];
        return stored == 0 ? type(uint256).max : stored - 1;
    }
}
