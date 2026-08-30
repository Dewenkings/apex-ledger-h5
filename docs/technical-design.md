# Apex Ledger 技术方案（第一阶段）

## 目标与边界

第一阶段是求职面试作品，不是托管资金的真实交易所。页面可完整演示行情发现、交易参数填写、模拟订单确认、订单管理、资产概览、SIWE 登录入口与设置；任何交易按钮都不会请求链上签名或扣除真实资产。

当前阶段没有 MCP 运行时依赖。市场数据适配器、Paper Engine、SIWE 会话和风险计算均先由项目自身实现。未来增加的 MCP Server 是本项目拥有的可选工具接口层，用于把既有能力提供给 LangGraph Agent，不参与前端首屏和核心交易链路。

## 分层

- **UI 层**：Next.js App Router 页面与共享 H5 壳层。Tailwind CSS v4 负责布局、响应式、组件状态与品牌主题令牌；只有图表裁剪、数据驱动颜色和复杂渐变保留少量原生 CSS。
- **领域层**：市场过滤、订单估算、导航状态等纯函数，便于单元测试。
- **数据适配层**：`OkxMarketAdapter` 已实现 BTC-USDT 公开 ticker 与 candles；Next.js Route Handlers 负责同源代理、参数校验、短缓存与错误清洗。后续 `TradingAdapter` 可在 Paper Engine、Testnet Engine 之间切换。
- **身份层（下一阶段）**：钱包仅用于 SIWE 登录。SIWE 消息签名与下单确认严格分开。

## 第一阶段双实时源行情实现

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
```

- `src/lib/market-data/types.ts`：稳定的应用内 ticker、candle 与周期类型。
- `src/lib/market-data/okx.ts`：OKX 字符串字段校验、数值转换、时间排序与公开 REST 请求；支持 `OKX_API_BASE_URL` 覆盖域名。
- `src/lib/market-data/kraken.ts`：Kraken ticker/OHLC 响应归一化及周期映射。
- `src/lib/market-data/market-service.ts`：按 OKX、Kraken 顺序选择首个可用实时数据源，每个生产请求设置 3.5 秒超时。
- `src/app/api/market/*`：浏览器同源 API，隐藏上游差异，并返回数据及真实来源标识。
- `src/components/trade/use-btc-market.ts`：请求取消、周期切换、重试及带标识的确定性回退数据。
- `src/components/trade/candlestick-chart.tsx`：Lightweight Charts 生命周期、缩放、拖动、十字线，以及由 ResizeObserver 驱动的宽高响应式尺寸。

公开行情不需要 API Key。前端不直接访问交易所，避免把上游响应格式、地区域名和限流策略耦合进 UI。页面严格区分 `OKX LIVE`、`KRAKEN LIVE`、`MIXED LIVE` 与 `DEMO DATA`。当前 REST 方案优先保证面试演示的确定性；WebSocket 实时推送留到第二阶段。

## 推荐后续资源

- 行情：继续扩展 OKX public WebSocket、订单簿与多币种 ticker；保留适配器接口以支持备用数据源。
- 钱包登录：wagmi + viem + WalletConnect/Reown + SIWE。
- 服务端：Next Route Handlers 或 FastAPI；PostgreSQL + Prisma/SQLAlchemy。
- AI/MCP：独立 Python LangGraph 服务；MCP Server 暴露 price、balance、gas、history、mock_trade 工具。
- 部署：Vercel（前端）+ Neon/Supabase（PostgreSQL）+ Railway/Fly.io（Python Agent，可选）。

## 安全约束

1. 前端永不接触助记词或私钥。
2. 默认环境始终为 `PAPER LIVE`，测试网必须二次显式切换。
3. 每个模拟订单都显示“不会产生链上交易或真实扣款”。
4. AI 只能给风险解释和建议，不能绕过用户确认自动下单。
5. 交易所公开行情只提供市场参考价格，不授予任何交易权限；两个实时源都失败时必须明确标注演示数据。
