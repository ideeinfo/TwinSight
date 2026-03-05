# 修复云端"追溯上游供电"问题 Walkthrough

## 修复 1：502 Bad Gateway

**根因**：Node.js 默认 `keepAliveTimeout=5s`，与阿里云 SLB 空闲超时冲突。

**修改**：`server/index.js` — 设置 `keepAliveTimeout=75s`、`headersTimeout=76s`、`timeout=300s`

---

## 修复 2：电源追溯时序竞争

**根因**：`handlePowerTraceAction` 和 `switchToPowerAndTrace` 用硬编码 `setTimeout(500ms)` 等待组件挂载和数据加载，云端网络延迟下不可靠。

| 文件 | 修改 |
|------|------|
| `PowerNetworkGraph.vue` | 新增 `dataReadyPromise`，`selectNodeByMcCode` 等待数据就绪（最多10s） |
| `AspectTreePanel.vue` | 轮询等待 `powerGraphRef` 就绪（最多5s） |
| `AppViewer.vue` | 轮询等待 `aspectTreePanelRef` 就绪（最多3s） |

---

## 修复 3：重复追溯失效

**根因**：LLM 在第二次追溯请求时看到会话历史中已执行过追溯，省略了 action 代码块，导致前端不触发操作。

| 文件 | 修改 |
|------|------|
| `skill-registry.js` | 新增 Prompt 规则 5：要求 LLM 对重复请求也必须生成 action 块 |
| `ai-service.js` | 后端兜底：当回复提及追溯但缺少 action 块时，自动注入 `power_trace_upstream` |

---

## 部署

```bash
cd /opt/twinsight
git pull origin main
docker compose up -d --build api
```
