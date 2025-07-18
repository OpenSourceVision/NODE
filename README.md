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
  - `out/` 目录：保存去重后的节点（Base64编码）
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
- `{protocol}.txt` - Base64编码的去重节点

例如：
- `raw/vmess_raw.txt` - 原始VMess节点
- `out/vmess.txt` - 去重后的VMess节点（Base64编码）

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

## 注意事项

- 确保网络连接正常
- 程序会自动创建 `out/` 和 `raw/` 目录
- 支持自动重试和错误恢复
- 去重算法基于节点的关键信息（协议、服务器、端口、UUID等）