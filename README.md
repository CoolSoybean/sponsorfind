# 英才通 · Sponsorfind

英国签证赞助机构静态查询网站。React + Vite，Python 标准库清洗，GitHub Actions 每日更新，Cloudflare Workers Static Assets 托管。没有用户下载入口，不部署 CSV。公开 JSON 仍能被浏览器读取。

## 本地运行

需要 Node.js 22+、pnpm 11.19.0、Python 3.12+。

```sh
pnpm install
python scripts/update_data.py
pnpm dev
```

打开终端显示的本地地址。首次必须成功获取数据，否则页面会显示可重试的错误状态，不使用虚构公司充数。

```sh
python -m unittest discover -s tests
pnpm test
pnpm build
pnpm preview
```

## 数据

程序从 GOV.UK 发布页面发现 CSV 链接，使用 UTF-8 BOM 兼容解析。只去除完全相同的重复行，不按机构名字合并。每条许可记录拥有内容生成的内部 ID（不是公司编号，字段变化后 ID 会变化）。原始名称、城市、县、路线、类型与评级保持对应关系。记录数不是独立公司数。

`public/data/manifest.json` 指向内容指纹版本；版本目录内含 index.json、a-z.json、0-9.json、other.json。首字符规则：NFKC、跳过前导标点、英文字母小写，数字分组，其他字符单独分组；不删除 The。

全局索引含全部列表和筛选字段，在 Web Worker 中搜索，支持任意位置关键词。字母条件与其他条件相交。详情按字母分片加载。政府名录字段较少，所以索引目前接近完整数据体积，这是保留全局搜索的明确取舍；将来丰富详情时分片价值更大。每页 20 条。

程序验证必需字段、记录数量、分片计数、静态文件 25 MiB 上限。相对上一版数量变化超过 20% 则阻止发布；核查后可在本地显式使用 --allow-large-change。失败时不会更新 manifest，工作流不会部署。

离线重建：`python scripts/update_data.py --csv /path/register.csv --source-updated 2026-09-04`。默认最少 10000 条，测试小文件可以显式设置 --min-records。

## GitHub 与 Cloudflare 上线

1. 将此目录推送到你的 GitHub 仓库 main 分支（不要提交 node_modules、work、dist、public/data 或任何凭据）。提交 pnpm-lock.yaml。
2. 在 Cloudflare 创建用于 Workers 发布的 API Token，权限限定所需账户的 Workers Scripts Edit。自定义域名可在控制台单独绑定。
3. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中设置 CLOUDFLARE_API_TOKEN 和 CLOUDFLARE_ACCOUNT_ID。
4. 在 Actions 手动执行 Update and deploy。它验证、抓取、构建并运行 wrangler deploy；成功后 Cloudflare 显示 workers.dev 地址。
5. 在 Cloudflare 为 sponsorfind 绑定已购买的域名。名称建议 sponsorfind.uk，未核查可注册性。

UTC 每日 07:23 运行，英国夏令时为 08:23；GitHub 调度可能延迟。公开仓库长期无活动时定时工作流可能被停用，需定期检查。启用 GitHub Actions 失败通知，并定期检查网页的数据日期；没有独立的站外存活监控。

工作流缓存成功部署的数据作为下次比较基线；缓存被驱逐后只能进行绝对阈值检查。旧版本保留以兼容打开中的网页；长期运行需归档旧版本，注意 Cloudflare 文件总数及 GitHub 缓存配额。发布为完整静态部署，失败保留线上正常版本。manifest 必须重新验证缓存；内容指纹文件长期缓存。

## 范围

无账号、下载、职位、薪资、行业推断、公司官网推断或牌照获批日期。资质不代表招聘或赞助承诺。无可靠公司标识时不合并同名机构。页面链接到官方发布页面而非特定公司的官方详情。

数据来源：https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers
数据遵循适用的 Open Government Licence v3.0；网站保留署名，不表示政府认可。

## 本次验证

已获取 2026-09-04 官方名录：142536 条许可记录，移除 545 条完全重复记录。索引采用字典编码，约 10.3 MB（未压缩）。自动检查索引中每条记录与分片的所有字段一致。首次全量加载仍需在实际手机网络下评估。构建会在缺失或不一致数据时失败。

可选浏览器 WebMCP 接口只读当前结果；没有支持的验证环境，未验证此可选接口。未执行浏览器截图或交互测试。

