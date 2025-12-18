# Node-RED 快速入门指南

## 📋 概述

Node-RED 是一个基于流程的可视化编程工具，非常适合 IoT 数据采集和处理。在 Tandem 项目中，我们使用它来：

- 模拟温度传感器数据
- 将数据写入 InfluxDB
- 创建数据处理流程
- 可视化调试数据流

## 🚀 快速启动

### 1. 启动服务

```bash
# 启动所有服务（包括 Node-RED）
docker-compose up -d

# 只启动 Node-RED 相关服务
docker-compose up -d influxdb nodered
```

### 2. 访问 Node-RED

打开浏览器访问：**http://localhost:1880**

### 3. 安装必要的节点

首次使用需要安装 InfluxDB 和 PostgreSQL 节点：

1. 点击右上角菜单 **☰** → **Manage palette**
2. 切换到 **Install** 标签
3. 搜索并安装以下节点：
   - `node-red-contrib-influxdb` - InfluxDB 连接
   - `node-red-contrib-postgres-multi` - PostgreSQL 连接
   - `node-red-dashboard` - 仪表盘（可选）

或者在容器内执行：
```bash
docker exec -it tandem-nodered npm install node-red-contrib-influxdb node-red-contrib-postgres-multi
docker restart tandem-nodered
```

## 📊 创建温度数据模拟流程

### 步骤 1：创建流程

将以下 JSON 导入 Node-RED（菜单 → Import → 粘贴）：

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "每5秒触发",
        "repeat": "5",
        "once": true,
        "onceDelay": "1",
        "wires": [["func1"]]
    },
    {
        "id": "func1",
        "type": "function",
        "name": "生成温度",
        "func": "const rooms = ['Room-101', 'Room-102', 'Room-103', 'Room-201'];\nconst room = rooms[Math.floor(Math.random() * rooms.length)];\nconst temp = 25 + (Math.random() - 0.5) * 10;\n\nmsg.payload = {\n    measurement: 'room_temp',\n    tags: { code: room },\n    fields: { value: Math.round(temp * 10) / 10 },\n    timestamp: Date.now()\n};\nreturn msg;",
        "wires": [["influx1", "debug1"]]
    },
    {
        "id": "influx1",
        "type": "influxdb out",
        "name": "写入 InfluxDB",
        "influxdb": "",
        "wires": []
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "调试",
        "wires": []
    }
]
```

### 步骤 2：配置 InfluxDB 连接

1. 双击 **写入 InfluxDB** 节点
2. 点击 **Server** 旁边的铅笔图标
3. 配置连接：

| 字段 | 值 |
|------|-----|
| Version | 2.0 |
| URL | `http://influxdb:8086` |
| Token | `tandem-influx-token-2024` |
| Organization | `demo` |
| Bucket | `tandem` |

4. 点击 **Add** → **Done** → **Deploy**

### 步骤 3：验证数据

1. 访问 InfluxDB：http://localhost:8086
2. 登录（admin / adminpassword）
3. 进入 **Data Explorer**
4. 选择 Bucket：`tandem`
5. 查看 `room_temp` 数据

## 🔌 连接 PostgreSQL

### 配置 PostgreSQL 连接

1. 拖入 **postgres** 节点
2. 双击配置连接：

| 字段 | 值 |
|------|-----|
| Host | `postgres` |
| Port | `5432` |
| Database | `tandem` |
| User | `postgres` |
| Password | `password` |

### 示例：查询资产数据

```json
{
    "id": "pg-query",
    "type": "function",
    "name": "构建查询",
    "func": "msg.payload = 'SELECT * FROM assets LIMIT 10';\nreturn msg;",
    "wires": [["postgres-node"]]
}
```

## 📈 高级用法

### 从外部 API 获取数据

```javascript
// HTTP 请求节点配置
{
    "url": "https://api.example.com/sensors",
    "method": "GET",
    "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
    }
}
```

### 批量写入 InfluxDB

```javascript
// 函数节点：批量数据格式化
msg.payload = [
    { measurement: 'room_temp', tags: { code: 'Room-101' }, fields: { value: 25.5 } },
    { measurement: 'room_temp', tags: { code: 'Room-102' }, fields: { value: 26.3 } },
    { measurement: 'room_temp', tags: { code: 'Room-103' }, fields: { value: 24.8 } }
];
return msg;
```

### 设置告警规则

```javascript
// 函数节点：温度告警检测
const temp = msg.payload.value;
const room = msg.payload.code;

if (temp < 0) {
    msg.alert = {
        type: 'LOW_TEMP',
        room: room,
        temp: temp,
        message: `⚠️ 低温警告: ${room} 温度 ${temp}°C`
    };
    return [msg, null];  // 输出到告警分支
} else if (temp > 35) {
    msg.alert = {
        type: 'HIGH_TEMP',
        room: room,
        temp: temp,
        message: `🔥 高温警告: ${room} 温度 ${temp}°C`
    };
    return [msg, null];
}
return [null, msg];  // 正常数据
```

## 🔗 与 Tandem Demo 集成

### 数据流向

```
传感器数据 → Node-RED → InfluxDB → Tandem 前端 (时序图表)
                ↓
            PostgreSQL → Tandem 前端 (资产/空间管理)
```

### API 调用示例

向 Tandem API 发送数据：

```javascript
// HTTP Request 节点配置
{
    "url": "http://host.docker.internal:3001/api/v1/timeseries/ingest",
    "method": "POST",
    "headers": {
        "Content-Type": "application/json"
    }
}
```

## 🛠️ 常见问题

### Q: 容器间无法连接？
确保使用容器名而不是 localhost：
- InfluxDB: `http://influxdb:8086`
- PostgreSQL: `postgres:5432`

### Q: 数据没有写入？
1. 检查 InfluxDB Token 是否正确
2. 查看 Node-RED 调试面板

### Q: 如何备份流程？
菜单 → Export → Download → 保存 JSON 文件

## 📚 相关链接

- [Node-RED 官方文档](https://nodered.org/docs/)
- [InfluxDB 节点文档](https://flows.nodered.org/node/node-red-contrib-influxdb)
- [PostgreSQL 节点文档](https://flows.nodered.org/node/node-red-contrib-postgres-multi)
