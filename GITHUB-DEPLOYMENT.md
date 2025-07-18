# GitHub 部署指南

本指南将帮助您在 GitHub 上部署和运行智能节点分类器。

## 🚀 快速开始

### 1. Fork 或上传项目到 GitHub

**方法一：Fork 项目**
- 如果项目已在 GitHub 上，直接 Fork 到您的账户

**方法二：创建新仓库**
1. 在 GitHub 创建新的公开或私有仓库
2. 将本地项目文件上传到仓库

### 2. 配置项目

确保您的仓库包含以下文件：
```
├── smart-enhanced.js     # 主程序
├── package.json         # 依赖配置
├── config.json          # 运行配置
├── url.yaml            # URL配置
├── .github/
│   └── workflows/
│       └── node-classifier.yml  # GitHub Actions工作流
└── GITHUB-DEPLOYMENT.md # 本说明文档
```

### 3. 配置 URL 源

编辑 `url.yaml` 文件，添加您的节点订阅链接：

```yaml
urls:
  - "https://example.com/subscription1"
  - "https://example.com/subscription2"
  # 添加更多URL...
```

### 4. 启用 GitHub Actions

1. 进入您的 GitHub 仓库
2. 点击 "Actions" 标签页
3. 如果首次使用，点击 "I understand my workflows, go ahead and enable them"

## ⚙️ 运行方式

### 自动运行
- **定时运行**：每天 UTC 00:00（北京时间 08:00）自动执行
- **代码更新触发**：当推送更新到 `url.yaml`、`config.json` 或 `smart-enhanced.js` 时自动运行

### 手动运行
1. 进入仓库的 "Actions" 页面
2. 选择 "智能节点分类器" 工作流
3. 点击 "Run workflow" 按钮
4. 选择分支（通常是 main 或 master）
5. 点击绿色的 "Run workflow" 按钮

## 📁 输出文件

运行完成后，分类的节点文件将：

1. **自动提交到仓库**：
   - `out/` 目录：包含去重后的分类节点文件
   - `raw/` 目录：包含原始节点文件

2. **作为 Artifacts 下载**：
   - 进入 Actions 页面
   - 点击具体的运行记录
   - 在页面底部下载 "classified-nodes-xxx" 文件

## 🔧 自定义配置

### 修改运行时间

编辑 `.github/workflows/node-classifier.yml` 文件中的 cron 表达式：

```yaml
schedule:
  # 每天UTC时间06:00运行 (北京时间14:00)
  - cron: '0 6 * * *'
```

### 修改运行配置

编辑 `config.json` 文件来调整：
- 网络超时时间
- 重试次数
- 支持的协议类型
- 输出格式等

## 📊 监控运行状态

1. **查看运行历史**：
   - 进入 Actions 页面查看所有运行记录
   - 绿色✅表示成功，红色❌表示失败

2. **查看运行日志**：
   - 点击具体的运行记录
   - 展开各个步骤查看详细日志

3. **运行状态徽章**：
   在 README.md 中添加状态徽章：
   ```markdown
   ![Node Classifier](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/智能节点分类器/badge.svg)
   ```

## 🔒 安全注意事项

1. **私有仓库推荐**：如果处理敏感的节点信息，建议使用私有仓库

2. **URL 安全**：确保 `url.yaml` 中的链接是可信的

3. **定期检查**：定期检查运行日志，确保没有异常

## 🛠️ 故障排除

### 常见问题

**问题 1：Actions 运行失败**
- 检查 `url.yaml` 格式是否正确
- 确认 URL 链接是否可访问
- 查看运行日志中的错误信息

**问题 2：没有输出文件**
- 检查 URL 是否返回有效的节点数据
- 确认网络连接正常
- 检查配置文件中的协议支持列表

**问题 3：提交失败**
- 确保仓库有写入权限
- 检查 GitHub Token 权限设置

### 调试步骤

1. 查看 Actions 运行日志
2. 检查配置文件语法
3. 手动测试 URL 可访问性
4. 在本地运行测试

## 📞 获取帮助

如果遇到问题：
1. 查看 Actions 运行日志
2. 检查项目的 Issues 页面
3. 参考本项目的 README.md 文档

---

**提示**：首次运行可能需要几分钟时间，请耐心等待。运行成功后，您将在仓库中看到更新的节点文件。