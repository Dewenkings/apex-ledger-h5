# Apex Ledger H5

一个以 Google Stitch 设计稿为视觉来源的移动端加密交易作品集。当前版本使用 Next.js、React、TypeScript 与 Tailwind CSS v4，聚焦可演示的 H5 产品闭环：行情发现、BTC/USDT 模拟交易、订单确认、订单管理、资产组合、钱包登录入口与设置。

## 安全声明

这是 `PAPER LIVE` 模拟交易项目：

- 不托管真实资产，不读取助记词或私钥。
- “确认订单”不会发送链上交易，也不会产生真实扣款。
- 钱包入口的目标是下一阶段接入 SIWE 消息登录，不是支付授权。

## 当前实现边界

当前应用不连接、不调用任何 MCP 服务。行情、Paper Trading、钱包会话和风险计算会先作为本仓库自己的适配器与服务实现；后续的 MCP Server 也由本项目自行开发，只负责把已经存在的能力暴露给 LangGraph Agent，而不是用 MCP 替代核心业务实现。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:3000`，会自动进入 `/markets`。

开发服务器固定绑定 `127.0.0.1`，同时允许 `localhost` 访问开发资源，避免两种本地地址混用导致 HMR 被 Next.js 拦截。

## 路由

- `/markets`：行情概览与搜索筛选
- `/trade/btc-usdt`：BTC/USDT 模拟交易
- `/trade/btc-usdt/confirm`：安全的 Paper Order 确认
- `/orders`：当前委托、历史订单、成交记录
- `/portfolio`：模拟资产总览
- `/portfolio/btc`：BTC 资产详情
- `/connect-wallet`：SIWE 钱包登录入口（当前为演示）
- `/settings`：个人与环境设置

## 公开实时行情（第一阶段）

`/trade/btc-usdt` 已接入双实时数据源：

- 主数据源为 OKX 推荐 REST 域名 `https://openapi.okx.com`，备用实时源为 Kraken Public API。
- 最新价格、24 小时高低价、成交量及 `1H / 4H / 1D / 1W` K 线均走同源 Next.js API。
- K 线使用 Lightweight Charts，采用移动端通栏布局和 `320–420px` 响应式高度，支持十字线、横向拖动和缩放。
- 页面会按实际响应显示 `OKX LIVE`、`KRAKEN LIVE` 或 `MIXED LIVE`；仅当两个实时源都失败时才显示 `DEMO DATA` 与重试按钮。
- 两个公开 Market Data API 均不需要 API Key。可通过 `OKX_API_BASE_URL` 指向你自己的可访问 OKX 网关或代理地址。

这一阶段没有 WebSocket、订单簿实时化或多币种接入，也没有 MCP 运行时。行情是真实公开行情，但所有下单流程仍为本地 PAPER LIVE 模拟交易，不会扣除钱包资产。

参考：[OKX API V5](https://app.okx.com/docs-v5/en)、[Kraken REST API](https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/)、[Lightweight Charts](https://tradingview.github.io/lightweight-charts/)。

## 质量命令

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

更完整的页面映射与架构边界见 `docs/design-handoff.md` 和 `docs/technical-design.md`。
