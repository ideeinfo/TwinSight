# 用户权限系统设计方案

## 概述

设计一个完整的用户认证与权限系统，支持多种登录方式（邮箱密码、Google、微信），基于 RBAC 模型进行权限控制。

## 现有基础

项目已有以下组件可复用：

| 组件 | 位置 | 状态 |
|------|------|------|
| JWT 配置 | `config/index.js` | ✅ 已有 |
| 权限定义 | `config/auth.js` | ✅ 已有完整的 RBAC |
| 认证中间件 | `middleware/auth.js` | ✅ 已有框架 |
| 错误处理 | `middleware/error-handler.js` | ✅ 已有 |
| 用户表 | `db/schema.sql` | ❌ 需要创建 |
| 认证路由 | `routes/v1/auth.js` | ❌ 需要创建 |
| OAuth 集成 | N/A | ❌ 需要创建 |

---

## 架构设计

```mermaid
graph TB
    subgraph 前端
        LoginPage[登录页面]
        AuthStore[Pinia Auth Store]
    end
    
    subgraph 认证入口
        EmailAuth[邮箱/密码]
        GoogleOAuth[Google OAuth]
        WeChatOAuth[微信 OAuth]
    end
    
    subgraph 后端
        AuthRouter[/api/v1/auth]
        AuthService[AuthService]
        UserModel[User Model]
        JWTMiddleware[JWT 中间件]
    end
    
    subgraph 数据库
        UsersTable[(users)]
        IdentitiesTable[(user_identities)]
        RolesTable[(user_roles)]
    end
    
    LoginPage --> EmailAuth
    LoginPage --> GoogleOAuth
    LoginPage --> WeChatOAuth
    
    EmailAuth --> AuthRouter
    GoogleOAuth --> AuthRouter
    WeChatOAuth --> AuthRouter
    
    AuthRouter --> AuthService
    AuthService --> UserModel
    UserModel --> UsersTable
    UserModel --> IdentitiesTable
    UserModel --> RolesTable
    
    AuthService -->|签发 JWT| AuthStore
    AuthStore -->|Bearer Token| JWTMiddleware
```

---

## 数据库设计

### 用户表

```sql
-- 用户主表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),            -- 仅邮箱登录用户有
    name VARCHAR(128),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户角色关联表（支持多角色）
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,             -- admin, manager, editor, viewer, guest
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

-- 第三方身份关联表（支持一个用户绑定多种登录方式）
CREATE TABLE user_identities (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,         -- 'email', 'google', 'wechat'
    provider_id VARCHAR(255) NOT NULL,     -- 第三方平台用户 ID
    provider_data JSONB,                   -- 存储第三方返回的额外信息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
);

-- 刷新令牌表（用于 JWT 刷新）
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_identities_provider ON user_identities(provider, provider_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token_hash);
```

---

## API 设计

### 认证路由 `/api/v1/auth`

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/register` | POST | 邮箱注册 | 否 |
| `/login` | POST | 邮箱登录 | 否 |
| `/logout` | POST | 登出 | 是 |
| `/refresh` | POST | 刷新令牌 | 否 |
| `/me` | GET | 获取当前用户信息 | 是 |
| `/me` | PUT | 更新当前用户信息 | 是 |
| `/oauth/google` | GET | Google OAuth 入口 | 否 |
| `/oauth/google/callback` | GET | Google OAuth 回调 | 否 |
| `/oauth/wechat` | GET | 微信 OAuth 入口 | 否 |
| `/oauth/wechat/callback` | GET | 微信 OAuth 回调 | 否 |

### 用户管理路由 `/api/v1/users`（管理员）

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/` | GET | 获取用户列表 | user:read |
| `/:id` | GET | 获取用户详情 | user:read |
| `/:id` | PUT | 更新用户 | user:update |
| `/:id` | DELETE | 删除用户 | user:delete |
| `/:id/roles` | PUT | 设置用户角色 | system:admin |

---

## JWT Token 结构

### Access Token Payload

```json
{
  "sub": 1,                    // 用户 ID
  "email": "user@example.com",
  "name": "张三",
  "roles": ["manager"],
  "permissions": [
    "asset:read",
    "asset:create",
    "space:read"
  ],
  "iat": 1704268800,
  "exp": 1704355200
}
```

### 令牌生命周期

| 令牌类型 | 有效期 | 存储位置 |
|----------|--------|----------|
| Access Token | 24 小时 | 内存 / LocalStorage |
| Refresh Token | 7 天 | HttpOnly Cookie |

---

## OAuth 集成

### Google OAuth 2.0

**所需配置**（环境变量）：
```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://your-domain/api/v1/auth/oauth/google/callback
```

**流程**：
1. 前端重定向到 `/api/v1/auth/oauth/google`
2. 后端重定向到 Google 授权页面
3. 用户授权后回调到 `/api/v1/auth/oauth/google/callback`
4. 后端获取用户信息，创建/关联用户，签发 JWT
5. 重定向回前端并携带 token

### 微信 OAuth 2.0

**所需配置**：
```bash
WECHAT_APP_ID=xxx
WECHAT_APP_SECRET=xxx
WECHAT_CALLBACK_URL=https://your-domain/api/v1/auth/oauth/wechat/callback
```

> [!NOTE]
> 微信登录需要已备案的服务号，暂时可先实现 Google 登录，微信作为预留。

---

## Proposed Changes

### Phase 1: 数据库与核心服务

#### [NEW] [create-auth-tables.sql](file:///d:/Tandem/antigravity/tandem-demo/server/db/migrations/create-auth-tables.sql)
创建用户、角色、身份、刷新令牌表。

#### [NEW] [user.js](file:///d:/Tandem/antigravity/tandem-demo/server/models/user.js)
用户数据模型，包含 CRUD 和身份关联操作。

#### [NEW] [auth-service.js](file:///d:/Tandem/antigravity/tandem-demo/server/services/auth-service.js)
认证服务：注册、登录、令牌管理、OAuth 处理。

---

### Phase 2: API 路由

#### [NEW] [auth.js](file:///d:/Tandem/antigravity/tandem-demo/server/routes/v1/auth.js)
认证路由：登录、注册、OAuth、令牌刷新。

#### [NEW] [users.js](file:///d:/Tandem/antigravity/tandem-demo/server/routes/v1/users.js)
用户管理路由（管理员）。

#### [MODIFY] [index.js](file:///d:/Tandem/antigravity/tandem-demo/server/routes/v1/index.js)
注册新路由。

---

### Phase 3: 中间件增强

#### [MODIFY] [auth.js](file:///d:/Tandem/antigravity/tandem-demo/server/middleware/auth.js)
增强认证中间件：从数据库加载用户权限。

#### [MODIFY] [auth.js](file:///d:/Tandem/antigravity/tandem-demo/server/config/auth.js)
添加 OAuth 配置。

---

### Phase 4: 前端集成

#### [NEW] [auth.js](file:///d:/Tandem/antigravity/tandem-demo/src/stores/auth.js)
Pinia auth store：管理用户状态和令牌。

#### [NEW] [LoginView.vue](file:///d:/Tandem/antigravity/tandem-demo/src/views/LoginView.vue)
登录页面组件。

#### [NEW] [auth.js](file:///d:/Tandem/antigravity/tandem-demo/src/services/auth.js)
前端认证 API 封装。

#### [MODIFY] [router/index.js](file:///d:/Tandem/antigravity/tandem-demo/src/router/index.js)
添加路由守卫。

---

## User Review Required

> [!IMPORTANT]
> **请确认以下设计决策**：

1. **默认用户角色**：新注册用户默认为 `viewer` 角色，是否合适？

2. **OAuth 优先级**：
   - Phase 1 先实现邮箱登录
   - Phase 2 添加 Google OAuth
   - Phase 3 添加微信 OAuth
   
   这个顺序可以吗？

3. **开发模式行为**：当前开发模式下跳过认证（见 `middleware/auth.js`），正式启用权限系统后是否保留此行为用于调试？

4. **密码策略**：
   - 最小长度 8 位
   - 必须包含字母和数字
   
   是否需要更严格的策略？

5. **会话管理**：是否需要"单设备登录"限制（新登录踢掉旧会话）？

---

## Verification Plan

### 自动化测试

1. **用户注册测试**
   ```bash
   curl -X POST http://localhost:3001/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test1234","name":"测试用户"}'
   ```

2. **登录测试**
   ```bash
   curl -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test1234"}'
   ```

3. **受保护路由测试**
   ```bash
   curl http://localhost:3001/api/v1/auth/me \
     -H "Authorization: Bearer <token>"
   ```

### 手动验证

1. **登录流程**
   - 访问登录页面
   - 使用邮箱密码登录
   - 验证跳转到主页
   - 检查 LocalStorage 中的 token

2. **权限验证**
   - 使用 viewer 角色登录
   - 尝试访问管理员功能（应被拒绝）
   - 登录 admin 账户验证可以访问

3. **令牌刷新**
   - 等待 access token 接近过期
   - 验证自动刷新机制
