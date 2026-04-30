# 🏦DeFi Staking Protocol: NFT-Powered Term Deposit Protocol

**Final Project Assignment - Blockchain Programming**

*An advanced decentralized savings system using ERC721 as Deposit Certificates.*

Hệ thống Tiền gửi Kỳ hạn Phi tập trung - Hệ thống quản lý tiền gửi tiết kiệm minh bạch dựa trên Smart Contract và NFT.

---
"Em xây dựng một DeFi Protocol cho phép người dùng tối ưu hóa lợi nhuận thông qua các gói Lock-up staking, sử dụng NFT làm bằng chứng tài sản (Proof of Deposit)."
## 👥 Roles & Permissions (Phân quyền)

### 👨‍💻 Depositor (Người dùng)
* **Gửi tiền (Deposit):** Chuyển Token vào hệ thống để bắt đầu tích lũy lãi.
* **Chứng chỉ NFT:** Nhận về một **"Sổ tiết kiệm điện tử" (ERC721)** chứa toàn bộ thông số khoản vay.
* **Tất toán (Withdraw):** Nộp lại (Burn) NFT khi đáo hạn để nhận lại **Tiền gốc + Lãi**.
* **Gia hạn (Renew):** Tái ký gửi để lãi nhập gốc (Compound interest).

### 👩‍💼 Bank Admin (Quản trị viên)
* **Thiết lập Plan:** Tạo các gói tiết kiệm (Ví dụ: 3 tháng lãi 5%, 12 tháng lãi 10%).
* **Quản trị Vault:** Quản lý kho tiền lãi, đảm bảo thanh khoản cho hệ thống.
* **Emergency Stop:** Quyền tạm dừng (Pause) toàn bộ hệ thống để bảo trì hoặc khi có sự cố.

---

## 🏗 System Architecture (Kiến trúc hệ thống)

Hệ thống được chia làm 3 khối chính để đảm bảo tính module và bảo mật:

| Component        | Biệt danh                  | Chức năng chính                                                                          |
| :--------------- | :------------------------- | :--------------------------------------------------------------------------------------- |
| **SavingCore**   | *Trạm thu phí & Xưởng đúc* | Quản lý logic gửi/rút, lưu trữ danh sách Plan và thực hiện Mint/Burn NFT.                |
| **VaultManager** | *Két sắt dự phòng*         | Nơi lưu trữ tiền lãi do Admin nạp vào. Chỉ giải ngân khi có lệnh xác thực từ SavingCore. |
| **MockUSDC**     | *Tiền tệ giao dịch*        | Token tiêu chuẩn ERC20 (6 decimals) dùng để mô phỏng dòng tiền thực tế.                  |

---

## 🗝️  Key Concepts (Chi tiết kỹ thuật)

### 1. Saving Plan (Cấu trúc Gói Tiết Kiệm)
| Field            | Meaning            | Unit / Note                                  |
| :--------------- | :----------------- | :------------------------------------------- |
| `tenorDays`      | Kỳ hạn gửi tiền    | Số ngày (Ví dụ: 7, 30, 90, 180, 365)         |
| `aprBps`         | Lãi suất năm (APR) | Basis Points (800 = 8.00% / năm)             |
| `min/maxDeposit` | Hạn mức gửi        | 0 = Không giới hạn                           |
| `penaltyBps`     | Phí rút trước hạn  | Khấu trừ vào tiền gốc (500 = 5%)             |
| `enabled`        | Trạng thái         | Admin có thể tắt để ngừng nhận khoản gửi mới |

### 2. Deposit Certificate (NFT)
Mỗi khoản gửi được lưu trữ dưới dạng NFT với các thông tin Snapshot:
* **Snapshot Logic:** APR và Penalty được khóa trực tiếp vào NFT khi mở. Thay đổi của Admin sau đó **không** ảnh hưởng đến NFT cũ.
* **Status:** `Active`, `Withdrawn`, `ManualRenewed`, `AutoRenewed`.

---

## 🛠️  Admin Functions (Chức năng quản trị)

Admin quản lý hệ thống thông qua `VaultManager` và cấu hình Plan. Admin **không thể** sửa đổi các khoản gửi đang hoạt động.

| Function             | Description                                                      |
| :------------------- | :--------------------------------------------------------------- |
| `createPlan`         | Tạo gói tiết kiệm mới với các tham số kỳ hạn, lãi suất, hạn mức. |
| `updatePlan`         | Thay đổi APR của gói (Chỉ ảnh hưởng đến các khoản gửi mới).      |
| `enable/disablePlan` | Bật/Tắt gói tiết kiệm để kiểm soát luồng tiền nạp.               |
| `fundVault`          | Nạp Token vào kho để đảm bảo khả năng trả lãi.                   |
| `withdrawVault`      | Rút Token từ kho lãi (trong giới hạn an toàn).                   |
| `setFeeReceiver`     | Thiết lập địa chỉ nhận phí phạt rút sớm.                         |
| `pause / unpause`    | Chế độ khẩn cấp: Ngăn chặn mọi thao tác rút và gia hạn.          |

---

## 📡  Required Events (Sự kiện hệ thống)
```solidity
event PlanCreated(uint256 indexed planId, uint256 tenorDays, uint256 aprBps);
event PlanUpdated(uint256 indexed planId, uint256 newAprBps);
event DepositOpened(uint256 indexed depositId, address indexed owner, uint256 planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen);
event Withdrawn(uint256 indexed depositId, address indexed owner, uint256 principal, uint256 interest, bool isEarly);
event Renewed(uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal, uint256 newPlanId);
```
---

## 📜  Business Rules Summary

Để đảm bảo tính minh bạch và an toàn cho tài sản của người dùng, hệ thống tuân thủ nghiêm ngặt các quy tắc sau:

### ⚖️ Tính minh bạch & Bất biến (Immutability)
* **Snapshot tại chỗ:** Lãi suất (APR) và tỷ lệ phí phạt (Penalty) được khóa vào NFT ngay khi người dùng mở khoản gửi. 
* **Quyền hạn Admin:** Mọi thay đổi về thông số của Plan sau đó chỉ áp dụng cho người gửi mới. Admin **không thể** sửa đổi thông số của các NFT đang hoạt động.

### 💸 Quy tắc tính lãi & Rút tiền
* **Lãi đơn (Simple Interest):** Hệ thống không tự động tính lãi kép trong một kỳ hạn gửi. Lãi chỉ được nhập gốc khi người dùng thực hiện **Gia hạn (Renew)**.
* **Rút sớm (Early Withdrawal):** Người dùng nhận **0 lãi** và bị trừ phí phạt trực tiếp vào tiền gốc. Toàn bộ tiền phạt sẽ được chuyển về địa chỉ `feeReceiver`.
* **Thanh khoản:** Tiền lãi luôn được chi trả từ `VaultManager`. Nếu số dư trong Vault không đủ để trả lãi, giao dịch rút tiền sẽ tự động `revert`.

### 🔄 Quy tắc Gia hạn (Renewal)
* **Bảo vệ người dùng (Auto-renew):** Trong trường hợp tự động gia hạn (sau 3 ngày ân hạn), hệ thống sẽ **bảo lưu lãi suất cũ** (`aprBpsAtOpen`) để bảo vệ người dùng khỏi việc lãi suất thị trường giảm đột ngột.

### 🛡️ Cơ chế bảo vệ khẩn cấp (Emergency)
> [!IMPORTANT]
> **Emergency Pause:** Khi hệ thống ở trạng thái `Paused`, mọi thao tác rút tiền (đúng hạn/trước hạn) và gia hạn (thủ công/tự động) đều bị chặn để đảm bảo an toàn tối đa cho quỹ tiền.


---
## 💰 Finance & Renewal Logic

Tất cả các khoản lãi suất được tính theo mô hình **Lãi đơn (Simple Interest)**. Tiền lãi chỉ được nhập gốc (compounding) tại thời điểm thực hiện gia hạn (Renew).

### 1. Math Formula
Sử dụng số nguyên để tính toán nhằm tránh lỗi làm tròn trong Solidity:

$$Interest = \frac{Principal \times APR_{bps} \times Tenor_{seconds}}{31,536,000 \times 10,000}$$

> **Note:** $31,536,000$ là tổng số giây trong một năm (365 ngày). Hệ số $10,000$ dùng để quy đổi Basis Points (bps) sang số thập phân.

---

### 2. Comparison: Manual vs. Auto Renew

| Feature           | Manual Renew                 | Auto Renew                    |
| :---------------- | :--------------------------- | :---------------------------- |
| **Trigger Time**  | `now >= maturityAt`          | `now >= maturityAt + 3 days`  |
| **New Plan**      | User-selected (`newPlanId`)  | Same as original plan         |
| **APR Rate**      | Current Market Rate          | **Locked Rate** (Snapshot cũ) |
| **Executor**      | NFT Owner                    | Anyone (Bot/Keeper)           |
| **New Principal** | $Principal_{old} + Interest$ | $Principal_{old} + Interest$  |

---

### 3. Execution Flow
Khi một khoản tiền được gia hạn (Renew), hệ thống thực hiện các bước sau:

1. **Validation:** Kiểm tra quyền sở hữu (nếu manual) và mốc thời gian (grace period).
2. **Interest Calc:** Tính toán lãi suất tích lũy của NFT cũ dựa trên Snapshot APR.
3. **Status Update:** Đánh dấu NFT cũ là `ManualRenewed` hoặc `AutoRenewed` để chặn rút tiền lần 2.
4. **New NFT Mint:** Khởi tạo một Deposit mới với:
    * **Principal:** Tổng gốc và lãi cũ.
    * **maturityAt:** `now + newTenor`.
    * Snapshot APR/Penalty mới theo quy tắc tương ứng.

---

### 4. Early Withdrawal Penalty
Nếu rút trước ngày `maturityAt`, người dùng sẽ không nhận được lãi và bị trừ phí phạt vào tiền gốc:

* **Interest:** $0$
* **Penalty:** $\frac{Principal \times Penalty_{bps}}{10,000}$
* **User Receives:** $Principal - Penalty$

## 📦 Deliverables

#### 📜 1. Smart Contracts
*   `MockUSDC.sol` — ERC20 token, 6 decimals, mintable for testing.
*   `VaultManager.sol` — Vault funding, fee receiver, pause/unpause.
*   `SavingCore.sol` — Plan management, deposit logic, withdraw, renew (manual + auto), ERC721 NFT minting.

#### 🧪 2. Tests
> Write a full test suite using **Hardhat + ethers.js** or **Hardhat + Waffle**. Coverage must be above **90%**.

**Minimum test cases:**
*   ✅ `createPlan`: valid plan, disabled plan, invalid APR.
*   ✅ `openDeposit`: happy path, below min, above max, disabled plan.
*   ✅ `withdrawAtMaturity`: correct interest, too early, already withdrawn.
*   ✅ `earlyWithdraw`: correct penalty, no interest paid.
*   ✅ `renewDeposit` (manual): correct new principal, status update.
*   ✅ `autoRenewDeposit`: before grace period (should fail), after grace period, APR locked.
*   ✅ `Vault`: fund, withdraw, insufficient vault for interest payout.
*   ✅ `Pause`: withdraw blocked when paused.

#### 💻 3. Frontend (Demo)
A simple React frontend that connects to **MetaMask** and lets a user:
*   🔍 View available plans.
*   💰 Open a deposit.
*   📑 View their active deposits.
*   🔄 Withdraw or renew a deposit.





## 📊 Evaluation Criteria

| Criteria                                     | Points  | Notes                     |
| :------------------------------------------- | :-----: | :------------------------ |
| Correct interest & penalty math              |   25    | Formula accuracy          |
| APR/penalty snapshot (immutable per deposit) |   15    | Key invariant             |
| Auto-renew with APR lock & grace period      |   15    | Edge case handling        |
| Vault management & pause/unpause             |   10    | Admin flows               |
| Test coverage > 90%                          |   20    | Including edge cases      |
| Frontend demo                                |   10    | UX & contract integration |
| Code quality & event emissions               |    5    | Readability, NatSpec      |
| **Total**                                    | **100** |                           |





### 💡 9. Hints & Tips
*Những mục này là gợi ý để giúp bạn tránh các lỗi thường gặp trong quá trình phát triển.*

*   **⏰ Time Management:** Sử dụng `block.timestamp` cho tất cả các kiểm tra thời gian. Trong môi trường test, hãy tận dụng các **Hardhat time helpers** để thực hiện việc "tua nhanh" thời gian (fast-forward).
*   **🔢 Token Precision:** Luôn lưu trữ số lượng token ở đơn vị nhỏ nhất (wei-equivalent). Ví dụ: Đối với USDC có 6 chữ số thập phân, **1 USDC = 1,000,000 units**.
*   **📐 Math Operations:** Công thức tính lãi suất sử dụng phép chia số nguyên. Quy tắc vàng là luôn **nhân trước, chia sau** để tránh mất độ chính xác.
    *   *Tip:* Luôn tính toán theo công thức $(a * b * c) / d$ thay vì $(a / d) * b * c$. Cách đầu tiên giúp giữ độ chính xác; cách thứ hai có thể làm kết quả bị triệt tiêu về 0 đối với các giá trị nhỏ.
*   **🏗️ Architecture:** Giữ số dư của **Vault** (quỹ dự trữ) và **Principal** (vốn gốc) tách biệt cả về mặt khái niệm lẫn kiến trúc để quản lý dòng tiền tốt hơn.
*   **🔄 Auto-renew Logic:** Đảm bảo kiểm tra điều kiện `now >= maturityAt + 3 days` trước khi cho phép thực hiện gia hạn tự động.
*   **🛡️ Security Mindset:** Hãy suy nghĩ kỹ về các lỗ hổng tiềm tàng, ví dụ như điều gì sẽ xảy ra nếu người dùng cố gắng rút tiền hai lần (Reentrancy hoặc Logic error).
*   **📦 Library Usage:** Cân nhắc sử dụng các thư viện chuẩn từ **OpenZeppelin** như `ERC721`, `Ownable`, và `Pausable` — nhưng hãy đảm bảo bạn hiểu rõ cơ chế hoạt động của chúng.