# Apex Ledger 技术方案（钱包身份与 Demo 交易阶段）

## 目标与边界

Apex Ledger 是一个面向市场观察、策略验证与交易流程演练的非托管模拟交易平台。系统使用真实公开行情和 OKX Demo Trading 复现订单生命周期，同时将钱包身份、链上只读资产与交易执行严格隔离。

平台主动排除充值、提现、实盘接口和链上写操作，不提供托管或真实资金交易能力。采用 Demo Trading 是为了在不移动真实资产的前提下保留订单确认、冻结、成交、撤单和历史查询等完整流程，并为公共访问提供可控、可重复的沙箱环境。

当前阶段没有 MCP 运行时依赖。市场数据适配器、Paper Engine、SIWE 会话和风险计算均先由项目自身实现。未来增加的 MCP Server 是本项目拥有的可选工具接口层，用于把既有能力提供给 LangGraph Agent，不参与前端首屏和核心交易链路。

## 分层

- **UI 层**：Next.js App Router 页面与共享 H5 壳层。Tailwind CSS v4 负责布局、响应式、组件状态与品牌主题令牌；只有图表裁剪、数据驱动颜色和复杂渐变保留少量原生 CSS。
- **领域层**：市场过滤、订单估算、导航状态等纯函数，便于单元测试。
- **数据适配层**：`OkxMarketAdapter` 实现现货 ticker、candles 与 instrument 查询，`KrakenMarketAdapter` 提供公开行情回退；Next.js Route Handlers 负责同源代理、参数校验、短缓存与错误清洗。
- **身份层**：Reown AppKit + wagmi 管理连接，SIWE 负责离线消息登录，Redis Repository 保存一次性 nonce 与不透明 Session。钱包连接、SIWE 和 Demo 门禁严格分开。
- **链上读取层**：wagmi `useBalance` 与 `useReadContracts(balanceOf)` 读取 Ethereum、Base、Arbitrum One、BNB Smart Chain 当前网络的原生币及白名单稳定币；不包含写链能力。

## 身份、授权与 owner 工作区

```text
Browser connector ── connect ──> public address + chain
                              └─> SIWE challenge/sign/verify ──> wallet session

Demo access code ──> independent 4h Demo authorization

anonymous owner: visitor:{uuid}
wallet owner:    eip155:account:{checksumAddress}
```

连接钱包不等于 SIWE 登录，SIWE 登录也不等于获得 Demo 交易权限。服务端生成 5 分钟一次性 nonce，绑定 visitor、address、chainId、domain、URI 与时间字段；验签成功后原子消费 nonce，创建 24 小时 HttpOnly Session，并把匿名订单工作区幂等迁移到钱包 owner。Demo 下单路由仍然必须通过独立访问码门禁。

客户端不存在 `sendTransaction`、`writeContract`、`useSendTransaction`、`useWriteContract` 或 approval 逻辑。SIWE 签名消息明确说明不授权转账或交易。

## 双账本资产语义

| 卡片 | 数据源 | 能否支持当前下单 | 失败隔离 |
|---|---|---:|---|
| `OKX DEMO · VIRTUAL FUNDS` | OKX Demo 私有余额 API | 是，虚拟资金 | RPC 失败不影响 |
| `ON-CHAIN · READ ONLY` | EVM 公共 RPC | 否 | Demo API 失败不影响 |

两张卡片不计算合并总额。链上读取支持 Ethereum、Base、Arbitrum One、BNB Smart Chain 的当前网络原生资产和 allowlist USDC/USDT；没有可信价格时 `usdValue` 保持 `null`，不伪造美元估值。任意 Token/NFT 扫描与链上交易属于后续独立需求。

## 前端目录边界

- `src/components/layout`：只包含 AppShell 与 BrandHeader，不依赖钱包、Demo 或服务端模块。
- `src/features/auth`：SIWE 浏览器客户端与状态机。
- `src/features/wallet`：连接、设置、链上只读查询。
- `src/features/portfolio`：Demo/On-chain 独立卡片与资产页面。
- `src/server/auth`、`src/server/identity`：只在服务端验签、存储 nonce/session、解析 owner。
- `src/components/screens.tsx`：仅为旧路由与测试保留兼容导出。

架构测试禁止浏览器 feature 导入 `@upstash/redis` 或 `src/server`，并保证 layout 不依赖业务 feature。

## 双实时源行情与实时订单簿

```text
TradeMarketPanel
  ├── GET /api/market/ticker
  └── GET /api/market/candles?period=1D
            ↓
      Market Data Service
        ├── 1. OkxMarketAdapter → openapi.okx.com
        └── 2. KrakenMarketAdapter → api.kraken.com
            ↓（两个实时源均失败）
      明确标注的 Demo Data

TradeScreen
  └── OkxBooks5Client ── WebSocket ──> OKX books5
            ├── 五档买卖盘归一化
            ├── instrument 与 payload 校验
            └── 断线重连与连接状态反馈
```

市场首页通过额外的聚合边界复用相同适配器：

```text
MarketScreen -> useMarketOverview -> GET /api/market/overview
                                      ├── OKX batch SPOT tickers
                                      ├── Kraken missing-pair fallback
                                      └── parallel 1H candle closes
```

- `src/lib/market-data/types.ts`：稳定的应用内 ticker、candle 与周期类型。
- `src/lib/market-data/okx.ts`：OKX 字符串字段校验、数值转换、时间排序与公开 REST 请求；支持 `OKX_API_BASE_URL` 覆盖域名。
- `src/lib/market-data/kraken.ts`：Kraken ticker/OHLC 响应归一化及周期映射。
- `src/lib/market-data/market-service.ts`：按 OKX、Kraken 顺序选择首个可用实时数据源，每个生产请求设置 3.5 秒超时。
- `src/lib/market-data/market-overview.ts`：按产品目录聚合八个 USDT 市场、补齐缺失来源并并行加载趋势数据。
- `src/app/api/market/*`：浏览器同源 API，隐藏上游差异，并返回数据及真实来源标识。
- `src/components/markets/use-market-overview.ts`：合并部分实时结果、逐行标注 Demo、保留最后一次成功快照并提供重试。
- `src/components/markets/market-screen.tsx`：首页来源、更新时间、搜索、分类、加载和错误状态。
- `src/components/trade/use-trade-market.ts`：请求取消、周期切换、重试及带标识的确定性回退数据。
- `src/lib/market-data/okx-books5-client.ts`：OKX `books5` WebSocket 订阅、消息校验、重连与生命周期管理。
- `src/components/trade/use-live-order-book.ts`：把订单簿连接状态和实时快照接入交易 UI。
- `src/components/trade/candlestick-chart.tsx`：Lightweight Charts 生命周期、缩放、拖动、十字线，以及由 ResizeObserver 驱动的宽高响应式尺寸。

公开行情不需要 API Key。ticker 与 candles 通过同源 REST 适配层获得缓存、响应归一化和 Kraken 回退能力；订单簿通过 OKX `books5` WebSocket 获取低延迟快照。页面严格区分 `OKX LIVE`、`KRAKEN LIVE`、`MIXED LIVE` 与 `DEMO DATA`，并独立呈现订单簿连接状态。

`/api/market/overview` 使用 30 秒共享缓存和 120 秒 stale-while-revalidate。服务端实时响应永不混入 fixture；缺失资产只在客户端目录合并阶段补入，并明确显示 `MIXED DATA`/`DEMO`。这使产品在弱网络或上游局部故障时保持可用，同时不把静态数字伪装成实时行情。

## 环境变量与部署

公开配置：

- `NEXT_PUBLIC_REOWN_PROJECT_ID`：Reown Cloud 项目标识，会进入浏览器包，不属于 Secret。
- `NEXT_PUBLIC_APP_URL`：生产部署 origin，用于 AppKit metadata 与 SIWE 同源配置。

服务端 Secret：

- `OKX_DEMO_API_KEY`、`OKX_DEMO_SECRET_KEY`、`OKX_DEMO_PASSPHRASE`
- `DEMO_ACCESS_CODE`、`SESSION_SECRET`
- `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`

本地复制 `.env.example` 为 `.env.local`。Vercel 中分别为 Production/Preview 配置变量并重新部署；Reown Cloud allowlist 同时加入生产域名、Preview 需要验证的域名及 localhost。服务端 Secret 不得使用 `NEXT_PUBLIC_` 前缀。

## 后续演进

- 行情：扩展订单簿深度、更多交易对与私有订单状态推送；保留适配器接口以支持备用数据源。
- 钱包登录：继续补充智能合约钱包验签、跨设备 E2E 与 Session 管理 UI。
- 服务端：Next Route Handlers 或 FastAPI；PostgreSQL + Prisma/SQLAlchemy。
- AI/MCP：独立 Python LangGraph 服务；MCP Server 暴露 price、balance、gas、history、mock_trade 工具。
- 部署：Vercel（前端）+ Neon/Supabase（PostgreSQL）+ Railway/Fly.io（Python Agent，可选）。

## 安全约束

1. 前端永不接触助记词或私钥。
2. 默认环境始终为 `PAPER LIVE`，测试网必须二次显式切换。
3. 每个模拟订单都显示“不会产生链上交易或真实扣款”。
4. AI 只能给风险解释和建议，不能绕过用户确认自动下单。
5. 交易所公开行情只提供市场参考价格，不授予任何交易权限；两个实时源都失败时必须明确标注演示数据。
6. 钱包 RPC 与 OKX Demo 是独立错误域，禁止在 UI 合并余额或权限。
7. Reown Project ID 可公开；OKX、Session 与 Redis 凭据必须仅存在服务端环境变量。

## 参考

- [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361)
- [Reown AppKit for Next.js](https://docs.reown.com/appkit/next/core/installation)
- [wagmi useBalance](https://wagmi.sh/react/api/hooks/useBalance)
- [wagmi useReadContracts](https://wagmi.sh/react/api/hooks/useReadContracts)
- [viem verifyMessage](https://viem.sh/docs/actions/public/verifyMessage)
