#!/bin/bash
# ============================================================
# Atomic API Week1 冒烟测试脚本
# 
# 用法：
#   chmod +x scripts/smoke/atomic-week1.sh
#   ./scripts/smoke/atomic-week1.sh [BASE_URL]
#
# 默认 BASE_URL: http://localhost:3001
# ============================================================

set -e

API="${1:-http://localhost:3001}"
TOKEN="${USER_JWT:-mock_admin_token}"
SVC="${SERVICE_TOKEN:-test_service_token}"
PID="${PROJECT_ID:-proj_001}"

PASS=0
FAIL=0
TOTAL=0

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 构建认证头参数（开发模式下 mock token 不发送 Authorization 头，让服务器走 dev bypass）
build_auth_header() {
  if [ "$TOKEN" != "mock_admin_token" ]; then
    echo "-H \"Authorization: Bearer ${TOKEN}\""
  fi
  # 不输出任何内容 = 不携带 Authorization 头
}

test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected_status="${5:-200}"

  TOTAL=$((TOTAL + 1))

  local status
  local auth_args=""
  if [ "$TOKEN" != "mock_admin_token" ]; then
    auth_args="-H \"Authorization: Bearer ${TOKEN}\""
  fi

  if [ "$method" = "POST" ]; then
    if [ -n "$auth_args" ]; then
      status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${API}${path}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "X-Service-Token: ${SVC}" \
        -H "X-Project-Id: ${PID}" \
        -H "X-Request-Id: smoke_$(date +%s)_${TOTAL}" \
        -H "Content-Type: application/json" \
        -d "${data}" 2>/dev/null)
    else
      status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${API}${path}" \
        -H "X-Service-Token: ${SVC}" \
        -H "X-Project-Id: ${PID}" \
        -H "X-Request-Id: smoke_$(date +%s)_${TOTAL}" \
        -H "Content-Type: application/json" \
        -d "${data}" 2>/dev/null)
    fi
  else
    if [ -n "$auth_args" ]; then
      status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X GET "${API}${path}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "X-Service-Token: ${SVC}" \
        -H "X-Project-Id: ${PID}" \
        -H "X-Request-Id: smoke_$(date +%s)_${TOTAL}" \
        2>/dev/null)
    else
      status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X GET "${API}${path}" \
        -H "X-Service-Token: ${SVC}" \
        -H "X-Project-Id: ${PID}" \
        -H "X-Request-Id: smoke_$(date +%s)_${TOTAL}" \
        2>/dev/null)
    fi
  fi

  if [ "$status" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} ${name} (HTTP ${status})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${name} (期望 ${expected_status}, 实际 ${status})"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Atomic API Week1 冒烟测试                      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  API: ${API}"
echo "  Project: ${PID}"
echo ""

# ========== 1. 健康检查 ==========
echo -e "${YELLOW}[1/7] 健康检查${NC}"
test_endpoint "API Health" "GET" "/api/health"

# ========== 2. Power Trace ==========
echo -e "${YELLOW}[2/7] 电源追溯${NC}"
test_endpoint "Power Trace" "POST" "/api/atomic/v1/power/trace" \
  '{"mcCode":"CP0101","direction":"upstream","fileId":1}'

# ========== 3. Timeseries Query ==========
echo -e "${YELLOW}[3/7] 时序查询${NC}"
test_endpoint "Timeseries Query (range)" "POST" "/api/atomic/v1/timeseries/query" \
  '{"roomCodes":["R001"],"fileId":1,"queryType":"range","startMs":1730000000000,"endMs":1730003600000}'

test_endpoint "Timeseries Query (latest)" "POST" "/api/atomic/v1/timeseries/query" \
  '{"roomCodes":["R001"],"fileId":1,"queryType":"latest"}'

# ========== 4. Assets Query ==========
echo -e "${YELLOW}[4/7] 资产查询${NC}"
test_endpoint "Assets Query (flat)" "POST" "/api/atomic/v1/assets/query" \
  '{"fileId":1,"aspectType":"power"}'

test_endpoint "Assets Query (tree)" "POST" "/api/atomic/v1/assets/query" \
  '{"fileId":1,"format":"tree"}'

# ========== 5. RAG Search ==========
echo -e "${YELLOW}[5/7] RAG 检索${NC}"
test_endpoint "RAG Search" "POST" "/api/atomic/v1/knowledge/rag-search" \
  '{"query":"机房温度异常处理建议","fileId":1}'

# ========== 6. UI Command ==========
echo -e "${YELLOW}[6/7] UI 控制指令${NC}"
test_endpoint "UI Command (highlight)" "POST" "/api/atomic/v1/ui/command" \
  '{"type":"highlight","target":"=A1.FAN01"}'

test_endpoint "UI Command (navigate)" "POST" "/api/atomic/v1/ui/command" \
  '{"type":"navigate","target":"=A1.ROOM01"}'

# ========== 7. Alarm Create ==========
echo -e "${YELLOW}[7/7] 报警创建${NC}"
test_endpoint "Alarm Create" "POST" "/api/atomic/v1/alarm/create" \
  '{"severity":"warning","source":"smoke-test","message":"冒烟测试报警"}'

# ========== 安全性验证 ==========
echo ""
echo -e "${YELLOW}[安全] 鉴权验证${NC}"

# 缺少 X-Project-Id 应返回 400
TOTAL=$((TOTAL + 1))
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API}/api/atomic/v1/assets/query" \
  -H "X-Service-Token: ${SVC}" \
  -H "Content-Type: application/json" \
  -d '{"fileId":1}' 2>/dev/null)
if [ "$status" = "400" ]; then
  echo -e "  ${GREEN}✓${NC} 缺少 X-Project-Id 返回 400 (HTTP ${status})"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} 缺少 X-Project-Id 应返回 400 (实际 ${status})"
  FAIL=$((FAIL + 1))
fi

# 缺少 X-Service-Token 应返回 401（开发模式下 service-auth 放行，所以期望 400 而非 401）
TOTAL=$((TOTAL + 1))
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API}/api/atomic/v1/assets/query" \
  -H "X-Project-Id: ${PID}" \
  -H "Content-Type: application/json" \
  -d '{"fileId":1}' 2>/dev/null)
if [ "$status" = "401" ]; then
  echo -e "  ${GREEN}✓${NC} 缺少 X-Service-Token 返回 401 (HTTP ${status})"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} 缺少 X-Service-Token 应返回 401 (实际 ${status})"
  FAIL=$((FAIL + 1))
fi

# ========== 总结 ==========
echo ""
echo "════════════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}全部通过${NC}: ${PASS}/${TOTAL} 测试"
else
  echo -e "  ${RED}存在失败${NC}: ${PASS}/${TOTAL} 通过, ${FAIL} 失败"
fi
echo "════════════════════════════════════════════════════"
echo ""

exit $FAIL
