# 数据库连接修复

## ❌ 问题
服务器启动失败，错误信息：
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 
'D:\Tandem\antigravity\tandem-demo\server\db\pool.js'
```

## ✅ 原因
`document.js` 模型文件错误地导入了不存在的 `pool.js`。

其他模型文件使用的正确导入方式是：
```javascript
import { query, getClient } from '../db/index.js';
```

## 🔧 修复
修改 `server/models/document.js`：

**之前**:
```javascript
import pool from '../db/pool.js';
// ...
const result = await pool.query(sql, values);
```

**之后**:
```javascript
import { query } from '../db/index.js';
// ...
const result = await query(sql, values);
```

## ✅ 结果
服务器现在应该可以正常启动了。

## 🚀 测试
1. 服务器应该自动重启（如果使用nodemon）
2. 或者手动重启：Ctrl+C 停止，然后 `npm run dev`
3. 查看控制台，应该没有错误
4. 测试文档上传功能

## 📝 涉及文件
- `server/models/document.js` - 修复了数据库导入
