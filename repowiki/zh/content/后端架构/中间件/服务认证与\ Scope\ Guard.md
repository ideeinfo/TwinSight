# 服务认证与 Scope Guard

<cite>
**本文档引用的文件**  
- [middleware/service-auth.js](file://server/middleware/service-auth.js)
- [middleware/scope-guard.js](file://server/middleware/scope-guard.js)
</cite>

## 概述

新增的中间件提供了微服务架构中的服务间认证和细粒度的权限控制功能。

## 目录

1. [服务认证 (service-auth)](#服务认证-service-auth)
2. [Scope Guard](#scope-guard)
3. [使用示例](#使用示例)
4. [配置说明](#配置说明)

## 服务认证 (service-auth)

### 功能

`service-auth.js` 实现了微服务之间的安全认证机制，确保只有授权的服务可以访问内部API。

### 核心实现

```javascript
const authenticateService = async (req, res, next) => {
  const serviceToken = req.headers['x-service-token'];
  
  if (!serviceToken) {
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_SERVICE_TOKEN', message: '缺少服务认证令牌' }
    });
  }
  
  try {
    const decoded = verifyServiceToken(serviceToken);
    req.service = {
      id: decoded.serviceId,
      name: decoded.serviceName,
      scopes: decoded.scopes
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SERVICE_TOKEN', message: '无效的服务认证令牌' }
    });
  }
};
```

### 令牌格式

服务令牌采用 JWT 格式，包含以下声明：

```json
{
  "serviceId": "logic-engine",
  "serviceName": "Logic Engine",
  "scopes": ["atomic:read", "atomic:write"],
  "iat": 1646908800,
  "exp": 1646995200
}
```

**章节来源**  
- [middleware/service-auth.js](file://server/middleware/service-auth.js)

## Scope Guard

### 功能

`scope-guard.js` 提供了基于 scope 的细粒度权限控制，支持资源级别的访问控制。

### 核心实现

```javascript
const guard = (requiredScope) => {
  return (req, res, next) => {
    const userScopes = req.user?.scopes || req.service?.scopes || [];
    
    if (!userScopes.includes(requiredScope)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `需要 scope: ${requiredScope}`,
          required: requiredScope,
          provided: userScopes
        }
      });
    }
    
    next();
  };
};

// 支持多个 scope（任一满足即可）
const guardAny = (scopes) => {
  return (req, res, next) => {
    const userScopes = req.user?.scopes || req.service?.scopes || [];
    
    const hasScope = scopes.some(scope => userScopes.includes(scope));
    if (!hasScope) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `需要以下任一 scope: ${scopes.join(', ')}`
        }
      });
    }
    
    next();
  };
};

// 支持多个 scope（全部满足）
const guardAll = (scopes) => {
  return (req, res, next) => {
    const userScopes = req.user?.scopes || req.service?.scopes || [];
    
    const missingScopes = scopes.filter(scope => !userScopes.includes(scope));
    if (missingScopes.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `缺少以下 scope: ${missingScopes.join(', ')}`
        }
      });
    }
    
    next();
  };
};
```

**章节来源**  
- [middleware/scope-guard.js](file://server/middleware/scope-guard.js)

## 使用示例

### 服务认证示例

```javascript
const express = require('express');
const { authenticateService } = require('../middleware/service-auth');

const router = express.Router();

// 内部服务API，需要服务认证
router.get('/internal/data', authenticateService, (req, res) => {
  console.log('Request from service:', req.service.name);
  res.json({ data: 'sensitive internal data' });
});

module.exports = router;
```

### Scope Guard 示例

```javascript
const express = require('express');
const { guard, guardAny, guardAll } = require('../middleware/scope-guard');

const router = express.Router();

// 读取资产 - 需要 atomic:assets:read
router.get('/assets', guard('atomic:assets:read'), (req, res) => {
  // 处理请求
});

// 创建资产 - 需要 atomic:assets:write
router.post('/assets', guard('atomic:assets:write'), (req, res) => {
  // 处理请求
});

// 管理告警 - 需要 atomic:alarms:manage
router.put('/alarms/:id', guard('atomic:alarms:manage'), (req, res) => {
  // 处理请求
});

// 任一权限即可
router.get('/reports', guardAny(['reports:read', 'admin:all']), (req, res) => {
  // 处理请求
});

// 需要全部权限
router.delete('/system', guardAll(['system:admin', 'data:purge']), (req, res) => {
  // 处理请求
});

module.exports = router;
```

### 组合使用

```javascript
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authenticateService } = require('../middleware/service-auth');
const { guard } = require('../middleware/scope-guard');

const router = express.Router();

// 组合认证：用户认证 + Scope 检查
router.get('/user-data',
  authenticate,
  guard('user:data:read'),
  (req, res) => {
    res.json({ user: req.user });
  }
);

// 组合认证：服务认证 + Scope 检查
router.post('/internal/sync',
  authenticateService,
  guard('internal:sync'),
  (req, res) => {
    res.json({ success: true });
  }
);

module.exports = router;
```

## 配置说明

### Scope 定义

在 `config/auth.js` 中定义所有可用的 scope：

```javascript
const SCOPES = {
  // Atomic API scopes
  'atomic:assets:read': '读取资产信息',
  'atomic:assets:write': '创建和修改资产',
  'atomic:power:read': '读取功率数据',
  'atomic:timeseries:read': '读取时序数据',
  'atomic:timeseries:write': '写入时序数据',
  'atomic:alarms:read': '读取告警信息',
  'atomic:alarms:manage': '管理告警规则',
  'atomic:knowledge:read': '读取知识库',
  'atomic:knowledge:admin': '管理知识库',
  'atomic:ui:read': '读取UI配置',
  'atomic:ui:write': '修改UI配置',
  
  // Admin scopes
  'admin:all': '所有管理权限',
  'system:admin': '系统管理权限',
  'user:manage': '用户管理权限',
  
  // Internal scopes
  'internal:sync': '内部数据同步',
  'internal:read': '内部数据读取'
};
```

### 服务令牌配置

在 `.env` 文件中配置服务令牌密钥：

```bash
# Service Auth
SERVICE_TOKEN_SECRET=your-secret-key-here
SERVICE_TOKEN_EXPIRY=24h
```

### 生成服务令牌

```javascript
const jwt = require('jsonwebtoken');

const generateServiceToken = (serviceId, serviceName, scopes) => {
  return jwt.sign(
    { serviceId, serviceName, scopes },
    process.env.SERVICE_TOKEN_SECRET,
    { expiresIn: process.env.SERVICE_TOKEN_EXPIRY }
  );
};

// 示例
const token = generateServiceToken(
  'logic-engine',
  'Logic Engine',
  ['atomic:read', 'atomic:write']
);
```

---

**最后更新**: 2025-03-10
