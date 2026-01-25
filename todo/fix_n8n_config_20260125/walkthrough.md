# AI Analysis n8n Configuration Fix Walkthrough

## 1. Goal
Enable the AI analysis feature to use the n8n service defined in `.env.local` (192.168.2.183:5678) instead of the default or fallback configuration.

## 2. Changes

### Backend Configuration
Modified `server/config/index.js` to strictly load `../../.env.local` with `override: true` after loading the default `.env`. This ensures local development settings take precedence.

```javascript
// server/config/index.js

// 加载环境变量 - 从项目根目录的 .env 文件
dotenv.config({ path: path.join(__dirname, '../../.env') });
// [NEW] 加载本地开发覆盖配置
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });
```

### Environment Variables
Updated `.env.local` to explicitly enable the n8n workflow.

```properties
# .env.local

N8N_WEBHOOK_URL=http://192.168.2.183:5678
# [NEW] Enable n8n workflow
USE_N8N_WORKFLOW=true
```

## 3. Verification Results

### Manual Verification Required
Since the environment environment is local to the user, the following steps are needed to verify the fix:

1.  **Server Restart**: The backend server should have automatically restarted due to the change in `server/config/index.js`.
    *   *Check Terminal Output*: Look for the log line: `🔧 AI 分析模式: n8n 工作流`
2.  **Functional Test**:
    *   Trigger an AI analysis (e.g., Temperature Alert).
    *   **Expectation**: The system calls `http://192.168.2.183:5678/...` and n8n records the workflow execution.

### Impact
-   **Before**: The system ignored `.env.local` for the n8n setting and `USE_N8N_WORKFLOW` was undefined (defaulting to false/OpenWebUI direct mode).
-   **After**: The system respects `.env.local` configuration, enabling the n8n integration.
