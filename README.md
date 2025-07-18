# 智能节点分类器

这个项目用于从指定的URL中拉取代理节点，自动去重，按照协议类型进行分类，并输出到不同目录。

## 功能特性

- **智能获取**: 支持从多个URL拉取节点数据，自动重试机制
- **多协议支持**: 自动解析多种代理协议
  - Shadowsocks (ss://)
  - ShadowsocksR (ssr://)
  - VMess (vmess://)
  - VLESS (vless://)
  - Trojan (trojan://)
  - Hysteria (hysteria://)
  - Hysteria2 (hysteria2://)
  - TUIC (tuic://)
  - WireGuard (wireguard://)
- **多格式解析**: 支持YAML、JSON和单行URL格式的节点数据
- **智能去重**: 自动识别并移除重复节点
- **双重输出**: 
  - `raw/` 目录：保存原始节点（YAML格式）
  - `out/` 目录：保存去重后的节点（URI格式）
- **详细日志**: 完整的处理过程记录和统计信息

## 安装依赖

```bash
npm install
```

## 使用方法

1. 在 `url.yaml` 文件中配置需要拉取的URL（每行一个URL）
2. 运行程序：

```bash
npm start
```

## 输出结构

### raw/ 目录（原始节点）
- `{protocol}_raw.txt` - 原始格式的节点数据

### out/ 目录（去重后节点）
- `{protocol}.txt` - URI格式的去重节点
- `all.txt` - 包含所有协议的去重节点

例如：
- `raw/vmess_raw.txt` - 原始VMess节点
- `out/vmess.txt` - 去重后的VMess节点（URI格式）
- `out/all.txt` - 所有去重后的节点（URI格式）

## 配置文件

### url.yaml
```yaml
https://example.com/subscribe1
http://example.com/subscribe2
https://example.com/subscribe3
```

### config.json
可自定义网络、输出和日志配置：
```json
{
  "network": {
    "timeout": 45000,
    "retries": 3,
    "ignoreSSLErrors": true
  },
  "logging": {
    "level": "info",
    "showProgress": true
  }
}
```

## 清理输出

```bash
npm run clean
```

## GitHub 部署

本项目支持在 GitHub 上自动运行，通过 GitHub Actions 实现定时获取和分类节点。

### 🚀 快速部署

1. **Fork 或上传项目到 GitHub**
2. **配置 `url.yaml`** - 添加您的节点订阅链接
3. **启用 GitHub Actions** - 进入仓库的 Actions 页面启用工作流
4. **自动运行** - 每天自动执行或手动触发运行

### 📋 运行方式

- **定时运行**: 每天 UTC 00:00（北京时间 08:00）自动执行
- **手动运行**: 在 Actions 页面点击 "Run workflow" 手动触发
- **代码更新触发**: 推送更新到配置文件时自动运行

### 📁 输出获取

运行完成后，分类的节点文件将：
- 自动提交到仓库的 `out/` 和 `raw/` 目录
- 可在 Actions 页面下载 Artifacts 文件

### 📖 详细部署指南

- 查看 [GitHub 部署指南](GITHUB-DEPLOYMENT.md) 获取完整的部署和配置说明
- 查看 [故障排除指南](TROUBLESHOOTING.md) 解决常见问题

## 注意事项

- 确保网络连接正常
- 程序会自动创建 `out/` 和 `raw/` 目录
- 支持自动重试和错误恢复
- 去重算法基于节点的关键信息（协议、服务器、端口、UUID等）
- GitHub 部署时建议使用私有仓库以保护敏感信息