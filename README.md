# Apex Ledger H5

一个以 Google Stitch 设计稿为视觉来源的移动端加密交易作品集。当前版本使用 Next.js、React、TypeScript 与 Tailwind CSS v4，聚焦可演示的 H5 产品闭环：真实公开行情、BTC/ETH/SOL 通用交易页、OKX 官方 Demo Trading、订单与成交、共享虚拟资产、钱包登录入口与设置。

## 安全声明

这是 `PAPER LIVE` 模拟交易项目，订单会进入 OKX 官方模拟盘，但不会进入真实资金环境：

- 不托管真实资产，不读取助记词或私钥。
- “确认订单”只使用服务端保存的 OKX Demo Key，不会发送链上交易，也不会产生真实扣款。
- 私有客户端固定携带 `x-simulated-trading: 1`，代码不存在切换到实盘 Base URL 的选项。
- API Key 只应启用 Demo Trading 的交易权限，禁止提现权限；Key、Secret 和 Passphrase 不进入浏览器包。
- 钱包入口的目标是下一阶段接入 SIWE 消息登录，不是支付授权。

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
- `/portfolio`：模拟资产总览
- `/portfolio/btc`：BTC 资产详情
- `/connect-wallet`：SIWE 钱包登录入口（当前为演示）
- `/settings`：个人与环境设置

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
2. 创建 Upstash Redis，用于限流、幂等、订单归属和当前会话的未结订单计数。
3. 复制 `.env.example` 为 `.env.local`，填写全部私有变量。不要把真实值提交到 Git，也不要粘贴到公开聊天或 Issue。
4. `DEMO_ACCESS_CODE` 是作品集访问码；登录后服务端签发 4 小时 HTTP-only、SameSite=Lax 的签名 Cookie。

写操作经过以下边界：同源校验、会话/IP 限流、单会话最多 5 个未结订单、单笔最多 250 USDT、精度校验、`Idempotency-Key`、超时后按 `clOrdId` 对账，以及撤单前再次校验会话订单归属。市价单的限额参考价由服务端读取真实公开行情，浏览器传值会被丢弃。

`/orders` 只返回当前访问会话创建的订单和成交。`/portfolio` 的余额来自同一个共享 OKX Demo 账户，因此 UI 明确显示“共享 OKX Demo 虚拟余额”，它不是当前钱包资产。

## Vercel 配置

把仓库导入 Vercel 后，在 Project Settings → Environment Variables 为 Production/Preview 配置 `.env.example` 中除可选 `OKX_API_BASE_URL` 外的全部变量，然后重新部署。私有 Demo API 在配置不完整时会安全返回 `503`，不会回退为本地假成交。

建议先在 Preview 环境验证：访问码登录、BTC/ETH/SOL 限价与市价单、OKX 订单号返回、订单查询、成交查询、撤单、共享虚拟余额，以及跨会话不可见/不可撤单。

参考：[OKX API V5](https://app.okx.com/docs-v5/en)、[Kraken REST API](https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/)、[Lightweight Charts](https://tradingview.github.io/lightweight-charts/)。

## 质量命令

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

更完整的页面映射与架构边界见 `docs/design-handoff.md` 和 `docs/technical-design.md`。
