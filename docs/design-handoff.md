# Stitch 设计交接与实现映射

## 已收到的页面

| Stitch 目录 | Next.js 路由 | 实现语义 |
| --- | --- | --- |
| market_overview | `/markets` | 默认首页、行情搜索与筛选 |
| trade_btc_usdt | `/trade/btc-usdt` | BTC/USDT 模拟交易 |
| confirm_transaction | `/trade/btc-usdt/confirm` | PAPER LIVE 订单确认，不是主网签名 |
| history | `/orders` | Open / History / Fills |
| my_wallet_redesign | `/portfolio` | 模拟资产组合总览 |
| ethereum_details | `/portfolio/btc` | 导出内容实际为 BTC 详情 |
| connect_wallet | `/connect-wallet` | SIWE 登录入口，无 Gas、无交易授权 |
| profile_settings | `/settings` | Apex Ledger 本地演示设置 |

## 视觉原则

- 深炭黑底色、低对比层级面、品牌绿 `#02c076 / #44e092`。
- Inter 风格正文与 JetBrains Mono 风格数字。
- 4px 网格、16px 页面边距、12px 卡片圆角。
- H5 以 390–430px 为主要视口，同时在桌面居中展示，不产生横向溢出。

## 有意修正

Stitch 文件仅作为视觉和信息架构参考。原“Confirm Transaction”中的 MAINNET、Uniswap 合约、Gas 和真实 ETH 总额，与已确认的作品范围冲突，因此改成明确的模拟订单确认。原设置页的 NEXUS PRO、KYC、提现额度与 VIP 等真实交易所语义也不进入第一阶段。

> 导出目录目前包含 8 个 Screen。先前报告提到的交易结果态、AI Risk Copilot 与系统异常态并未包含在本次文件中，留作后续增量实现。
