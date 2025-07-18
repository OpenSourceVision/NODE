# 故障排除指南

本文档提供了智能节点分类器在 GitHub 上运行时可能遇到的常见问题及解决方案。

## 🚨 常见错误

### 1. 权限错误 (403 Forbidden)

**错误信息：**
```
remote: Write access to repository not granted.
fatal: unable to access 'https://github.com/username/repo/': The requested URL returned error: 403
Error: Process completed with exit code 128.
```

**解决方案：**

#### 方法一：配置仓库权限（推荐）
1. 进入您的 GitHub 仓库
2. 点击 "Settings" 标签页
3. 在左侧菜单中选择 "Actions" → "General"
4. 找到 "Workflow permissions" 部分
5. 选择 "Read and write permissions"
6. 勾选 "Allow GitHub Actions to create and approve pull requests"
7. 点击 "Save" 保存设置

#### 方法二：使用个人访问令牌
1. 生成个人访问令牌：
   - 进入 GitHub Settings → Developer settings → Personal access tokens
   - 点击 "Generate new token (classic)"
   - 选择 "repo" 权限
   - 复制生成的令牌

2. 添加到仓库密钥：
   - 进入仓库 Settings → Secrets and variables → Actions
   - 点击 "New repository secret"
   - Name: `PERSONAL_TOKEN`
   - Value: 粘贴您的个人访问令牌

3. 修改工作流文件中的 GITHUB_TOKEN：
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.PERSONAL_TOKEN }}
   ```

### 2. 网络超时错误

**错误信息：**
```
Error: connect ETIMEDOUT
Error: Request timeout
```

**解决方案：**
1. 检查 `url.yaml` 中的 URL 是否可访问
2. 增加超时时间，修改 `config.json`：
   ```json
   {
     "network": {
       "timeout": 60000,
       "retries": 5
     }
   }
   ```

### 3. 依赖安装失败

**错误信息：**
```
npm ERR! code ENOTFOUND
npm ERR! network request failed
```

**解决方案：**
1. 检查 `package.json` 中的依赖是否正确
2. 在工作流中添加 npm 缓存清理：
   ```yaml
   - name: 清理 npm 缓存
     run: npm cache clean --force
   
   - name: 安装依赖
     run: npm install
   ```

### 4. 文件路径错误

**错误信息：**
```
Error: ENOENT: no such file or directory
```

**解决方案：**
1. 确保所有必要文件都已提交到仓库
2. 检查文件路径是否正确
3. 确保 `out/` 和 `raw/` 目录存在或程序能自动创建

### 5. YAML 格式错误

**错误信息：**
```
YAMLException: bad indentation
YAMLException: unexpected end of the stream
```

**解决方案：**
1. 检查 `url.yaml` 文件格式：
   ```yaml
   urls:
     - "https://example.com/sub1"
     - "https://example.com/sub2"
   ```

2. 使用在线 YAML 验证器检查语法

## 🔍 调试步骤

### 1. 查看详细日志
1. 进入 Actions 页面
2. 点击失败的运行记录
3. 展开每个步骤查看详细输出
4. 查找错误信息和堆栈跟踪

### 2. 本地测试
在推送到 GitHub 之前，先在本地测试：
```bash
# 安装依赖
npm install

# 运行程序
npm start

# 检查输出
ls out/
ls raw/
```

### 3. 逐步调试
1. 先注释掉 `url.yaml` 中的大部分 URL，只保留一个
2. 运行测试，确认基本功能正常
3. 逐步添加更多 URL

## 🛠️ 高级故障排除

### 启用调试模式
在工作流文件中添加调试输出：

```yaml
- name: 调试信息
  run: |
    echo "当前目录: $(pwd)"
    echo "文件列表:"
    ls -la
    echo "Node.js 版本: $(node --version)"
    echo "npm 版本: $(npm --version)"
    echo "Git 状态:"
    git status
```

### 检查环境变量
```yaml
- name: 检查环境
  run: |
    echo "GITHUB_TOKEN 长度: ${#GITHUB_TOKEN}"
    echo "仓库: $GITHUB_REPOSITORY"
    echo "分支: $GITHUB_REF"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 手动触发测试
使用 `workflow_dispatch` 手动触发工作流进行测试：

1. 进入 Actions 页面
2. 选择工作流
3. 点击 "Run workflow"
4. 选择分支并运行

## 📞 获取帮助

如果以上解决方案都无法解决您的问题：

1. **检查 GitHub Status**：访问 [GitHub Status](https://www.githubstatus.com/) 确认服务正常

2. **查看官方文档**：
   - [GitHub Actions 文档](https://docs.github.com/en/actions)
   - [工作流语法](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

3. **社区支持**：
   - GitHub Community Forum
   - Stack Overflow

4. **创建 Issue**：在项目仓库中创建详细的问题报告，包括：
   - 错误信息的完整日志
   - 您的配置文件内容
   - 重现步骤
   - 环境信息

---

**提示**：大多数问题都与权限配置有关，请优先检查仓库的 Actions 权限设置。