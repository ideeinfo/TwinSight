# N8N 稳定性优化操作指南

## 一、 更新 Docker 配置
我们已经更新了 `docker-compose.lan.yml`，增加了 n8n 的默认超时设置（300秒）。你需要重新创建容器以应用此更改。

### 操作步骤
在服务器或本地终端执行：
```powershell
# 停止旧容器
docker compose -f docker/docker-compose.lan.yml down

# 重新启动容器
docker compose -f docker/docker-compose.lan.yml up -d
```
*注：这不会丢失你的任何工作流数据，数据保存在 Volume 中。*

---

## 二、 优化 N8N 工作流节点 (关键步骤)

即使环境变量已设置，对于已经创建的 HTTP Request 节点，建议手动检查以下两点以确保万无一失。

### 1. 修改 URL 为 Docker 内部地址
**原来的做法**:
使用宿主机 IP，如 `http://192.168.2.183:3080/api/chat/completions`

**推荐的做法 (更快更稳)**:
使用 Docker 服务名，如 `http://open-webui:8080/api/chat/completions`

**为什么这样做？**
n8n 和 Open WebUI 都在同一个 Docker 网络 (`twinsight-network`) 中。使用内部服务名 `open-webui` 可以直接通过 Docker内部 DNS 解析到容器 IP，不经过路由器的 NAT 转发，速度更快且不受宿主机 IP 变更影响。
*注意：内部端口通常是 8080，而不是外部映射的 3080。*

### 2. 手动设置 Timeout
虽然我们设置了默认值，但建议显式设置该节点。

1. 打开调用 Open WebUI 的 **HTTP Request** 节点。
2. 点击底部的 **Settings** (设置) 选项卡（或者在节点配置底部的 "Options" / "Add Option"）。
3. 找到 **Timeout** 选项。
   - 如果没有看到，可能需要点击 "Add Option" -> "Timeout"。
4. 将其设置为 `300` (秒) 或更大。
   - LLM 生成长回复有时需要 60-90秒，默认的 30秒很容易断开。

### 3. (可选 but 推荐) 检查 Retry On Fail
在 Settings 中，还可以开启 **Retry On Fail** (失败重试)。
- **Times**: 2
- **Wait Between Tries**: 1000 (ms)
这样在偶发的网络抖动时，n8n 会自动重试一次。

## 三、 测试
完成上述修改后，手动执行一次工作流。
如果 60秒内能返回结果，且不再报错 "connection aborted"，则说明修复成功。
