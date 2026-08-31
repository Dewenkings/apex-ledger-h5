# Apex Ledger H5

一个以 Google Stitch 设计稿为视觉来源的移动端加密交易作品集。当前版本使用 Next.js、React、TypeScript 与 Tailwind CSS v4，聚焦可演示的 H5 产品闭环：真实公开行情、BTC/ETH/SOL 通用交易页、OKX 官方 Demo Trading、订单与成交、Reown 钱包连接、SIWE 登录，以及链上只读资产。

## 安全声明

这是 `PAPER LIVE` 模拟交易项目，订单会进入 OKX 官方模拟盘，但不会进入真实资金环境：

- 不托管真实资产，不读取助记词或私钥。
- “确认订单”只使用服务端保存的 OKX Demo Key，不会发送链上交易，也不会产生真实扣款。
- 私有客户端固定携带 `x-simulated-trading: 1`，代码不存在切换到实盘 Base URL 的选项。
- API Key 只应启用 Demo Trading 的交易权限，禁止提现权限；Key、Secret 和 Passphrase 不进入浏览器包。
- 钱包使用 Reown AppKit + wagmi + viem；SIWE 只签署可读登录消息，不调用 `sendTransaction`、`writeContract` 或 Token approval。
- 钱包连接、SIWE 登录和 OKX Demo 访问码是三个独立状态。任何一个状态都不会自动授权另外两个状态。

## 当前实现边界

当前应用不连接、不调用任何 MCP 服务。行情、Paper Trading、钱包会话和风险计算会先作为本仓库自己的适配器与服务实现；后续的 MCP Server 也由本项目自行开发，只负责把已经存在的能力暴露给 LangGraph Agent，而不是用 MCP 替代核心业务实现。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://127.0.0.1:3000`，会自动进入 `/markets`。

开发服务器固定绑定 `127.0.0.1`，同时允许 `localhost` 访问开发资源，避免两种本地地址混用导致 HMR 被 Next.js 拦截。

## 路由

- `/markets`：行情概览与搜索筛选
- `/trade/btc-usdt`、`/trade/eth-usdt`、`/trade/sol-usdt`：通用实时行情与模拟交易
- `/trade/[pair]/confirm`：受控访问与 OKX Demo Order 确认
- `/orders`：当前委托、历史订单、成交记录
- `/portfolio`：OKX Demo 虚拟资金与 EVM 链上只读资产（双账本，永不合并总额）
- `/portfolio/btc`：BTC 资产详情
- `/connect-wallet`：Reown 钱包连接与 SIWE 登录
- `/settings`：钱包、SIWE 与 Demo 门禁状态管理

## 钱包身份与双账本

钱包能力采用 Reown AppKit、wagmi、viem 与 SIWE，支持 Ethereum、Base 和 Arbitrum：

1. `connect` 只获取公开地址与网络，不等于登录。
2. `SIWE authenticated` 通过离线消息签名证明地址所有权，不产生 Gas，也不授权交易。
3. `demoAuthorized` 由独立作品集访问码控制 OKX Demo 写操作；SIWE 不会绕过该门禁。

首次 SIWE 成功后，当前匿名访客工作区会幂等迁移到 `eip155:account:{checksumAddress}`。因此同一钱包在另一浏览器重新完成 SIWE 后，可以恢复钱包名下的模拟订单；没有 SIWE 时仍使用隔离的匿名访客工作区。

资产页采用严格双账本语义：`OKX DEMO · VIRTUAL FUNDS` 来自共享模拟交易账户；`ON-CHAIN · READ ONLY` 通过 RPC 读取当前钱包的原生 ETH 与白名单 USDC/USDT。两类资产不相加，且任一数据源失败不会清空另一张卡片。

## 公开实时行情

三个交易页已接入双实时数据源：

- 主数据源为 OKX 推荐 REST 域名 `https://openapi.okx.com`，备用实时源为 Kraken Public API。
- 最新价格、24 小时高低价、成交量及 `1H / 4H / 1D / 1W` K 线均走同源 Next.js API。
- K 线使用 Lightweight Charts，采用移动端通栏布局和 `320–420px` 响应式高度，支持十字线、横向拖动和缩放。
- 页面会按实际响应显示 `OKX LIVE`、`KRAKEN LIVE` 或 `MIXED LIVE`；仅当两个实时源都失败时才显示 `DEMO DATA` 与重试按钮。
- 两个公开 Market Data API 均不需要 API Key。可通过 `OKX_API_BASE_URL` 指向你自己的可访问 OKX 网关或代理地址。

当前没有 WebSocket 或真实订单簿实时化，也没有 MCP 运行时。页面中的“演示深度”不是交易所订单簿，并已在 UI 明示。

`/markets` 行情首页使用独立的 `/api/market/overview` 聚合接口：

- 覆盖 `BTC / ETH / SOL / BNB / ADA / AVAX / DOT / POL` 八个 USDT 现货市场，旧 `MATIC` 展示已迁移为 `POL`。
- OKX 使用一次批量 spot ticker 请求；缺失交易对再由 Kraken 公共接口补齐，近期 `1H` 收盘价用于迷你趋势图。
- 页面同时显示数据来源与更新时间；部分实时结果显示 `MIXED DATA`，缺失行逐条标为 `DEMO`。
- API 使用 `s-maxage=30, stale-while-revalidate=120`，刷新失败时客户端保留最后一次实时结果。
- BTC、ETH、SOL 行进入相应通用交易页，其余资产不会生成无效的 `#` 交易链接。

## OKX 官方 Demo Trading

1. 在 OKX 的 Demo Trading 环境创建 API Key，仅授予模拟交易所需权限，不授予提现权限。
2. 创建 Upstash Redis，用于限流、幂等、访客订单账本、订单快照和未结订单计数。
3. 复制 `.env.example` 为 `.env.local`，填写全部私有变量。不要把真实值提交到 Git，也不要粘贴到公开聊天或 Issue。
4. `DEMO_ACCESS_CODE` 是作品集访问码；验证后服务端签发 4 小时访问门禁 Cookie，并创建或复用一个 30 天的 HTTP-only、SameSite=Lax 匿名访客 Cookie。

写操作经过以下边界：同源校验、访客/IP 限流、单访客最多 5 个未结订单、单笔最多 250 USDT、全站 UTC 日订单与名义金额上限、精度校验、`Idempotency-Key`、超时后按 `clOrdId` 对账，以及撤单前再次校验服务端订单快照归属。市价单的限额参考价由服务端读取真实公开行情，浏览器传值会被丢弃。

OKX 接受订单后，应用会先把访客订单索引与展示快照写入 Redis，再通过 `instId + ordId` 调用 OKX 单笔订单接口更新权威状态；因此即使 OKX 账户级列表暂时返回空数组，订单也不会从作品集页面消失。OKX 暂时不可用时，页面会展示最后快照并标记上次同步时间。

`/orders` 只返回当前 owner 工作区的订单和成交。未登录时 owner 为匿名访客；SIWE 成功后 owner 为钱包地址，匿名快照会幂等迁移。不同 owner 不能查看或撤销彼此订单。`/portfolio` 的 Demo 余额仍来自同一个共享 OKX Demo 账户，因此 UI 明确显示“共享 OKX Demo 虚拟余额”；钱包余额位于独立的只读链上卡片。

## Vercel 配置

把仓库导入 Vercel 后，在 Project Settings → Environment Variables 为 Production/Preview 配置 `.env.example` 中除可选 `OKX_API_BASE_URL` 外的变量，然后重新部署。`NEXT_PUBLIC_REOWN_PROJECT_ID` 来自 Reown Cloud，是会进入浏览器包的公开配置；OKX Key/Secret/Passphrase、访问码、Session Secret 和 Upstash Token 必须保持服务端 Secret。私有 Demo API 在配置不完整时会安全返回 `503`，不会回退为本地假成交。

Reown Cloud 项目需要加入 `https://apex-ledger-h5.vercel.app`，本地开发加入 `http://127.0.0.1:3000` 和 `http://localhost:3000`。建议额外设置 `NEXT_PUBLIC_APP_URL` 为部署域名，使 SIWE domain/URI、AppKit metadata 与服务端同源校验一致。

建议先在 Preview 环境验证：钱包连接、SIWE 可读消息、刷新后无 hydration warning、访问码登录、BTC/ETH/SOL 限价与市价单、跨浏览器钱包工作区恢复、成交查询、撤单、双账本隔离，以及钱包 RPC 失败时 Demo 功能仍可用。

参考：[OKX API V5](https://app.okx.com/docs-v5/en)、[Kraken REST API](https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/)、[Lightweight Charts](https://tradingview.github.io/lightweight-charts/)。

## 质量命令

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

更完整的页面映射与架构边界见 `docs/design-handoff.md` 和 `docs/technical-design.md`。
