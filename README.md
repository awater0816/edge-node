# edge-node

VLESS over WebSocket 单文件节点，用于在 **Render 免费层** 跑一个自己的代理出口。

## 一键部署

点这个链接，用 GitHub 登录后点 Deploy：

https://render.com/deploy?repo=https://github.com/awater0816/edge-node

部署完成后你会得到一个地址，形如 `https://edge-node-xxxx.onrender.com`。

## 客户端配置（xray / v2rayN / 手机 v2rayNG）

- 地址: 你的 `xxx.onrender.com`
- 端口: 443
- 用户 ID (UUID): 见 render.yaml 的 UUID
- 传输: ws
- 路径: /
- TLS: 开（sni/host 同上）

vless://<UUID>@<你的域名>:443?encryption=none&security=tls&type=ws&host=<你的域名>&sni=<你的域名>&path=%2F&fp=chrome#render-edge

## 免费层限制

- 15 分钟无请求会休眠，下次请求冷启动约 30–60 秒
- 每月 750 小时（够 1 个常驻服务全月）
- 每月 100 GB 出站流量
