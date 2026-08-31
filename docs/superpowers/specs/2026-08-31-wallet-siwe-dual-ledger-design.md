# Apex Ledger 钱包 SIWE 与双资产账本设计

## 背景

Apex Ledger 当前已经具备真实公开行情、OKX 官方 Demo Trading 下单，以及按匿名访客隔离的订单账本。现有“连接钱包”页面仍是静态交互，个人设置展示的是演示地址；资产页只展示共享 OKX Demo 虚拟余额。

下一阶段需要接入真实 EVM 钱包连接和 SIWE 登录，同时把原型式代码整理为更容易维护、测试和讲解的模块结构。钱包登录不得改变模拟盘的资金语义，也不得引入链上转账、Token 授权或真实交易。

## 目标

- 支持 Ethereum、Base、Arbitrum 三条 EVM 网络。
- 支持 MetaMask、Coinbase Wallet、WalletConnect 及 EIP-6963 注入钱包。
- 使用 EIP-4361 SIWE 消息完成无 Gas、无转账的地址所有权验证。
- 同一钱包在新浏览器完成 SIWE 后可恢复该钱包名下的 Demo 订单工作区。
- 钱包登录前创建的匿名订单在首次绑定时迁移到钱包工作区。
- 资产页同时展示 OKX Demo 交易资产与链上只读钱包资产，且不可混为同一可交易余额。
- 围绕钱包与身份功能完成定向企业级重构：模块边界、错误模型、数据访问、测试和文档清晰。

## 非目标

- 不发送链上交易，不调用 `eth_sendTransaction`。
- 不请求 ERC-20 allowance，不做 Swap、充值、提现或真实支付。
- 不接 OKX 实盘账户，也不让访客提供个人 OKX API Key。
- 不支持 Solana、Bitcoin 或多链 SIWX；这些属于后续独立阶段。
- 不扫描任意 ERC-20/NFT 全量资产；第一版只读取原生币和明确 allowlist 的 Token。
- 不为了目录形式全面重写行情、图表和已稳定的 OKX Demo 逻辑。

## 方案比较

### 方案 A：wagmi + viem，自建连接弹窗与 SIWE

优点是依赖和 UI 完全可控，能深入展示底层能力。缺点是需要自行处理钱包发现、移动端深链、二维码、连接器状态、错误提示和兼容性，十天作品集阶段投入过大。

### 方案 B：Reown AppKit + wagmi + viem + SIWE（采用）

AppKit 负责行业常见的钱包发现和连接体验；wagmi 管理 React 钱包状态与查询缓存；viem 负责类型安全的链上读取和签名验证；`siwe` 负责 EIP-4361 消息格式。服务端 nonce、验签、会话和身份绑定仍由项目自己实现，因此既有完整的工程深度，也避免重复造钱包连接 UI。

### 方案 C：托管式 Web3 Auth / Embedded Wallet

登录体验最顺滑，也能覆盖邮箱和社交账号，但会引入供应商身份体系、嵌入式钱包和额外安全语义，偏离“证明 EVM 钱包登录能力”的作品目标，当前不采用。

## 核心原则：一个身份，两个资产域

```text
EVM Wallet
  ├─ Connect：发现地址与 chainId
  ├─ SIWE：证明地址所有权，建立应用会话
  └─ On-chain Reader：读取链上只读余额

Apex Identity
  ├─ anonymous owner: visitor:{uuid}
  └─ authenticated owner: eip155:account:{address}

OKX Demo Trading
  ├─ 开发者的共享模拟账户余额
  ├─ 按 ownerId 隔离的订单快照与成交
  └─ 独立 Demo Access 授权和全站风险限制
```

钱包连接、SIWE 登录和 Demo Trading 权限是三个不同状态：

1. `disconnected`：没有钱包连接，仍可浏览公开行情。
2. `connected`：浏览器已授权读取地址，但尚未证明登录会话。
3. `authenticated`：SIWE 验签成功，服务端建立钱包身份会话。
4. `demoAuthorized`：当前访客另外具备 OKX Demo 写操作权限。

SIWE 登录不会自动获得 Demo Trading 权限。这样公开钱包登录不会把共享 OKX Demo API 暴露为无限制公共交易入口。

## 资产数据语义

### OKX Demo 交易账户

- 来源：服务端 OKX Demo API。
- 含义：共享 Demo API Key 对应的虚拟余额和模拟交易能力。
- 用途：订单额度校验、模拟下单、撤单和成交。
- UI 标签：`OKX DEMO · VIRTUAL FUNDS`。
- 不得命名为“我的钱包余额”。

### 已连接钱包

- 来源：EVM Public Client / RPC，只读调用。
- 第一版资产：当前网络原生币，以及服务端/代码 allowlist 中的 USDC、USDT。
- 估值：复用现有市场服务可确认的币种报价；无可靠报价时只显示 Token 数量。
- UI 标签：`ON-CHAIN · READ ONLY`。
- 不参与 OKX Demo 的下单额度、持仓或盈亏计算。

资产页默认先展示 OKX Demo 交易账户，因为当前产品主线是模拟交易；钱包卡片独立展示，登录后展开链上资产。任何汇总数字必须按资产域分别计算，不提供把 Demo 虚拟资产与真实链上资产相加的“总资产”。

## 身份与工作区模型

新增稳定的 `ownerId` 抽象：

- 匿名：`visitor:{visitorId}`。
- 钱包：`eip155:account:{checksumAddress}`。chainId 是会话属性，不进入 EVM 账户主身份，避免同一地址在 Base、Arbitrum 被误认为不同用户。

订单快照从直接依赖 `visitorId` 演进为依赖 `ownerId`。已有匿名访客无需立即迁移；读取时可以兼容旧记录。

首次 SIWE 成功时：

1. 锁定 `visitorId -> wallet ownerId` 的绑定操作。
2. 将当前匿名访客的订单索引合并到钱包 owner 索引，订单快照更新 ownerId。
3. 若钱包 owner 已有订单，执行去重合并，不覆盖更新更晚的快照。
4. 写入绑定完成标记后建立钱包会话。
5. 任一步骤失败则不签发钱包会话，允许安全重试。

同一钱包在其他浏览器重新 SIWE 后直接使用钱包 ownerId，因此可以恢复订单。切换钱包只切换当前钱包会话，不得把前一个钱包的订单迁移给新钱包；只有该浏览器仍属于匿名 owner 的订单可以在首次绑定时迁移。

## SIWE API 与流程

### `POST /api/auth/siwe/nonce`

- 要求合法同源请求。
- 输入：当前已连接地址和 chainId。
- 校验地址格式及允许网络。
- 创建至少 128 bit 随机 nonce，Redis TTL 5 分钟。
- nonce 绑定 visitorId、地址、chainId、domain，且只能消费一次。
- 返回构造 SIWE 消息需要的 nonce、issuedAt、expirationTime 和 statement。

### `POST /api/auth/siwe/verify`

- 使用 Zod 校验 message 和 signature 的长度、格式。
- 解析 EIP-4361 message。
- 严格验证 domain、URI、nonce、address、chainId、issuedAt、expirationTime。
- 原子消费 nonce，防止并发重放。
- 使用 viem Public Client 验证 EOA、ERC-1271 与 ERC-6492 能力范围内的签名。
- 完成 owner 工作区绑定/迁移。
- 建立服务端钱包会话，返回脱敏地址、chainId 和过期时间。

### `GET /api/auth/siwe/session`

- 仅返回最少必要会话数据：`authenticated`、EIP-55 checksum `address`、chainId、expiresAt；UI 负责缩写展示。
- 不返回签名、nonce 或 Redis key。

### `DELETE /api/auth/siwe/session`

- 删除服务端会话并清理 HttpOnly Cookie。
- 不删除链上数据、Demo 订单或匿名 visitor Cookie。
- 钱包连接器断开和应用退出登录分别处理；UI 可以提供“仅断开钱包”和“退出应用身份”。

## 会话与安全

- 钱包会话 Cookie：`apx_wallet_session`，随机不透明 session ID，不在 Cookie 中直接保存可伪造身份声明。
- Redis session TTL：24 小时；用户再次签名才能续期。
- Cookie：`HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`。
- 所有写路由校验 `Origin`/`Host`，生产仅接受配置的 canonical origin。
- nonce 先验证再原子消费；失败次数和 nonce 请求按 IP + visitorId 限流。
- SIWE message 必须显示清晰 statement：仅登录 Apex Ledger，不授权转账或交易。
- 日志只记录 requestId、错误码、chainId 和脱敏地址；不记录 message、signature、完整 Cookie 或 nonce。
- 前端不保存签名，不把身份 session 放入 localStorage。
- `NEXT_PUBLIC_REOWN_PROJECT_ID` 是公开客户端配置，不是 Secret；服务端 Session Secret、Redis Token 和 OKX 凭证继续使用 Secret。

## Next.js 与 React 集成

依赖：

- `@reown/appkit`
- `@reown/appkit-adapter-wagmi`
- `wagmi`
- `viem`
- `@tanstack/react-query`
- `siwe`

Provider 使用官方 Next.js SSR 思路：wagmi `ssr: true`、Cookie Storage 和 `cookieToInitialState`，避免再次出现服务端与客户端连接状态不同导致的 hydration mismatch。`QueryClient` 在客户端 Provider 内稳定创建，不能在 render 过程中异步更新全局状态。

## 定向企业级重构

```text
src/
├── app/api/auth/siwe/          # HTTP 边界
├── features/
│   ├── auth/                   # SIWE 用例与客户端状态
│   ├── wallet/                 # 连接、网络、只读余额 UI
│   └── portfolio/              # 双资产域组合展示
├── server/
│   ├── auth/                   # nonce、验签、session
│   ├── identity/               # owner 与 workspace 迁移
│   └── repositories/           # Redis 端口与实现
├── providers/                  # AppKit/Wagmi/Query Provider
├── components/layout/          # AppShell、导航、Header
└── lib/web3/                   # chain/token allowlist 与纯函数
```

重构规则：

- Route Handler 只处理 HTTP、schema 和状态码，不直接拼 Redis key。
- 领域用例依赖 Repository 接口；Redis 是实现细节。
- React 页面不直接调用 viem client 或 Redis API。
- Query Hook 按资源拆分：session、demo balance、orders、wallet balances。
- `screens.tsx` 中 Connect/Settings 页面拆到独立 feature，保留兼容 re-export 后再逐步删除聚合文件。
- 错误统一为稳定 code + 用户文案；不把第三方原始错误直接返回浏览器。
- 只重构与身份、资产和页面壳层直接相关的代码，行情/K 线不做无关改写。

## UI 交互

### 连接页

1. AppKit 选择钱包并连接。
2. 展示地址、网络和“连接不等于登录”。
3. 用户点击“签名并登录”。
4. 获取 nonce、构造可读 SIWE message、钱包签名、服务端验签。
5. 成功后进入资产页；拒签停留并提供重试，不视为错误交易。

### 资产页

- 第一张卡：OKX Demo 虚拟交易资产。
- 第二张卡：链上只读钱包资产；未连接时提供连接入口。
- 连接错误网络时允许切换到 Ethereum、Base 或 Arbitrum。
- RPC 失败只影响钱包卡片，不影响 Demo 余额和订单。
- Demo API 失败只影响 Demo 卡片，不影响链上钱包资产。

### 设置页

- 展示真实钱包地址、当前网络和 SIWE 会话状态。
- 提供复制地址、切换网络、断开连接、退出 SIWE 会话。
- 明确显示 Demo Trading 授权是另一套权限。

## 错误与降级

- 未安装浏览器钱包：仍可通过 WalletConnect 移动端连接。
- 用户拒绝连接或签名：保持未登录，不弹交易失败文案。
- 网络不支持：引导切换 allowlist 网络。
- nonce 过期/已使用：获取新 nonce，绝不复用旧签名。
- RPC 不可用：保留最后成功快照并标记陈旧，或仅显示地址。
- Reown Project ID 缺失：构建时给出明确配置错误；公开行情和 Demo API 服务端逻辑不依赖该值。
- 工作区迁移失败：不签发钱包 session，不产生半登录状态。

## 测试与验收

### 单元测试

- SIWE domain、URI、chainId、nonce、时间和签名验证。
- nonce 单次消费、过期和并发重放。
- ownerId 生成及匿名订单合并幂等性。
- Token allowlist、金额格式和资产域汇总隔离。

### 路由集成测试

- nonce、verify、session、logout 正常与错误状态码。
- Origin/Host、限流、非法 address/signature。
- Redis 故障时不签发错误会话。

### 组件测试

- 未连接、已连接未登录、SIWE 已登录、拒签、错误网络。
- Demo 余额与钱包余额使用不同标题和数据源。
- 钱包 RPC 失败不会清空 Demo 账户 UI。

### 生产验收

- MetaMask 桌面连接和 SIWE。
- WalletConnect 手机扫码/深链。
- 刷新后 SSR 无 hydration mismatch。
- 同钱包换浏览器登录后恢复钱包 owner 的订单。
- 所有钱包动作均不出现转账、授权或 Gas 确认。

## 配置资源

- Reown Cloud 项目：提供 `NEXT_PUBLIC_REOWN_PROJECT_ID`，允许生产域名与本地域名。
- EVM RPC：第一阶段优先使用 AppKit/Wagmi 默认传输；生产稳定性需要时再增加专用只读 RPC。
- 现有 Upstash Redis：保存 nonce、SIWE session、身份绑定和 workspace 索引。
- 现有 OKX Demo：保持服务端共享模拟账户，不与钱包凭证混合。

## 发布与迁移

1. 先增加 owner 抽象和旧 visitor 兼容读取。
2. 增加 SIWE API 与测试，默认不改变现有页面。
3. 接入 Provider 和连接页。
4. 增加双资产卡片和设置页。
5. 生产环境配置 Reown Project ID 后启用入口。
6. 新逻辑稳定后再移除旧 `screens.tsx` 钱包占位实现。

整个迁移期间，未连接钱包的访客仍可使用现有公开行情；已有匿名 Demo 订单不会因部署丢失。

## 参考资料

- [ERC-4361: Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)
- [Reown AppKit Next.js Installation](https://docs.reown.com/appkit/next/core/installation)
- [Reown AppKit SIWE](https://docs.reown.com/appkit/react/core/siwe)
- [wagmi](https://wagmi.sh/)
- [viem verifyMessage](https://viem.sh/docs/actions/public/verifyMessage)
