# 测试属性编辑功能

## 启动步骤

### 1. 启动后端服务器

打开一个新的终端窗口，进入server目录：

```bash
cd server
npm run dev
```

服务器应该在 `http://localhost:3001` 启动

### 2. 启动前端开发服务器

在另一个终端窗口（项目根目录）：

```bash
npm run dev
```

前端应该在 `http://localhost:5173` 启动

### 3. 测试编辑功能

1. 在浏览器打开应用
2. 选择一个资产或空间
3. 在右侧属性面板点击一个字段进行编辑
4. 修改值后按 Enter 保存
5. 查看浏览器控制台，应该看到：
   ```
   🔄 正在调用 API: PATCH http://localhost:3001/api/assets/[编码]
   📝 更新字段: name = [新值]
   📡 API响应状态: 200 OK
   ✅ API返回数据: {...}
   ✅ 资产属性更新成功
   ```

### 4. 验证数据持久化

1. 点击其他资产
2. 再次点击刚才编辑的资产
3. 检查编辑的字段是否显示新值

## 可能的问题

### 问题1：API调用失败 (404或500错误)

**原因**: 后端服务器未启动

**解决**: 确保在 `server/` 目录下运行了 `npm run dev`

### 问题2：CORS错误

**原因**: 跨域请求被阻止

**解决**: 检查 `server/index.js` 中是否正确配置了 CORS

### 问题3：数据库连接错误

**原因**: PostgreSQL未启动或配置错误

**解决**: 
- 检查 `.env` 文件中的数据库配置
- 确保 PostgreSQL 服务正在运行
- 运行 `npm run db:init` 初始化数据库

### 问题4：编辑后数据不持久

**症状**: 编辑成功但切换后数据丢失

**可能原因**:
1. API调用失败（检查控制台错误日志）
2. 数据库更新失败（检查后端服务器日志）
3. 重新加载数据时没有从数据库获取（检查 App.vue 的数据加载逻辑）

**调试步骤**:
1. 打开浏览器控制台（F12）
2. 切换到 Console 标签
3. 编辑一个字段
4. 查看是否有 🔄、📝、📡、✅ 开头的日志
5. 如果有 ❌ 错误日志，记录错误信息

## 当前实现状态

✅ 前端编辑UI完成
✅ EditableField 组件完成
✅ 本地状态管理完成
✅ API调用逻辑完成
✅ 后端路由添加 (PATCH /api/assets/:code, PATCH /api/spaces/:code)
✅ 数据库更新方法 (updateAsset, updateSpace)
✅ 详细日志记录

## 数据库字段映射

### 资产 (Assets)
| UI字段 | API字段 | 数据库列 |
|--------|---------|----------|
| name | name | name |
| typeComments | spec_code | spec_code |
| level | floor | floor |
| room | room | room |

### 空间 (Spaces)  
| UI字段 | API字段 | 数据库列 |
|--------|---------|----------|
| name | name | name |
| area | area | area |
| perimeter | perimeter | perimeter |
| level | floor | floor |
| spaceNumber | classification_code | classification_code |
| spaceDescription | classification_desc | classification_desc |
