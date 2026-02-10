<# 
.SYNOPSIS
    Twinsight 数据迁移脚本 - 从本地 Docker 导出数据
.DESCRIPTION
    此脚本用于将本地 Windows Docker 中的数据导出，
    以便迁移到局域网 Ubuntu 服务器
.NOTES
    在 PowerShell 中运行: .\export-data.ps1
#>

param(
    [switch]$PostgresOnly,
    [switch]$InfluxOnly,
    [switch]$Help
)

# 配置
$BackupDir = "D:\TwinSIght\backup\migration_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$PostgresContainer = "twinsight-postgres"
$InfluxContainer = "influxdb2"

# 颜色输出函数
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Show-Help {
    Write-ColorOutput "Twinsight 数据迁移脚本" "Cyan"
    Write-ColorOutput "========================" "Cyan"
    Write-Host ""
    Write-Host "用法: .\export-data.ps1 [选项]"
    Write-Host ""
    Write-Host "选项:"
    Write-Host "  -PostgresOnly  仅导出 PostgreSQL 数据"
    Write-Host "  -InfluxOnly    仅导出 InfluxDB 数据"
    Write-Host "  -Help          显示帮助"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\export-data.ps1              # 导出所有数据"
    Write-Host "  .\export-data.ps1 -PostgresOnly # 仅导出 PostgreSQL"
}

function Test-DockerRunning {
    try {
        docker info 2>&1 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Test-ContainerRunning {
    param([string]$ContainerName)
    $result = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>&1
    return $result -eq $ContainerName
}

function Export-PostgreSQL {
    Write-ColorOutput "`n[PostgreSQL] 开始导出..." "Yellow"
    
    if (-not (Test-ContainerRunning $PostgresContainer)) {
        Write-ColorOutput "错误: PostgreSQL 容器未运行" "Red"
        return $false
    }
    
    $outputFile = "$BackupDir\postgres_twinsight.sql"
    
    # 导出完整数据库
    Write-Host "  导出数据库结构和数据..."
    docker exec $PostgresContainer pg_dump -U postgres twinsight > $outputFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $fileSize = (Get-Item $outputFile).Length / 1KB
        Write-ColorOutput "  ✓ PostgreSQL 导出成功: $outputFile ($([math]::Round($fileSize, 2)) KB)" "Green"
        
        # 仅导出结构（用于生产环境初始化）
        $schemaFile = "$BackupDir\postgres_schema_only.sql"
        docker exec $PostgresContainer pg_dump -U postgres --schema-only twinsight > $schemaFile 2>&1
        Write-ColorOutput "  ✓ 结构导出: $schemaFile" "Green"
        
        return $true
    } else {
        Write-ColorOutput "  ✗ PostgreSQL 导出失败" "Red"
        return $false
    }
}

function Export-InfluxDB {
    Write-ColorOutput "`n[InfluxDB] 开始导出..." "Yellow"
    
    if (-not (Test-ContainerRunning $InfluxContainer)) {
        Write-ColorOutput "错误: InfluxDB 容器未运行" "Red"
        return $false
    }
    
    $influxBackupDir = "$BackupDir\influx_backup"
    New-Item -ItemType Directory -Force -Path $influxBackupDir | Out-Null
    
    # 获取 Token (从 .env 或环境变量)
    $token = "SsFt9slg5E2jS6HmvxuaePjebpkNVRi-S0wrDexjQWOFXDeARRY8NeJ-_Dqe6eAzsyuWtIVHFmSs3XMuv0x1ww=="
    
    Write-Host "  在容器内创建备份..."
    docker exec $InfluxContainer influx backup /tmp/influx_backup --token $token 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  从容器复制备份文件..."
        docker cp "${InfluxContainer}:/tmp/influx_backup" $influxBackupDir
        
        Write-ColorOutput "  ✓ InfluxDB 导出成功: $influxBackupDir" "Green"
        return $true
    } else {
        Write-ColorOutput "  ✗ InfluxDB 导出失败 (可能无数据或 Token 错误)" "Yellow"
        return $false
    }
}

function Export-NodeRedFlows {
    Write-ColorOutput "`n[Node-RED] 提示" "Yellow"
    Write-Host "  Node-RED 流程需要通过 Web 界面导出:"
    Write-Host "  1. 打开 http://localhost:1880"
    Write-Host "  2. 点击右上角菜单 -> Export -> All flows"
    Write-Host "  3. 保存到 $BackupDir\nodered_flows.json"
}

function Export-N8nWorkflows {
    Write-ColorOutput "`n[n8n] 提示" "Yellow"
    Write-Host "  n8n 工作流需要通过 Web 界面导出:"
    Write-Host "  1. 打开 http://localhost:5678"
    Write-Host "  2. 选择工作流 -> 右上角菜单 -> Download"
    Write-Host "  3. 保存到 $BackupDir\"
    Write-Host ""
    Write-Host "  或者复制现有的工作流 JSON 文件:"
    Write-Host "  项目中已有: n8n-workflows/*.json"
}

function Show-UploadInstructions {
    Write-ColorOutput "`n========================================" "Cyan"
    Write-ColorOutput "   数据导出完成！" "Green"
    Write-ColorOutput "========================================" "Cyan"
    Write-Host ""
    Write-Host "备份目录: $BackupDir"
    Write-Host ""
    Write-ColorOutput "下一步: 上传到 Ubuntu 服务器" "Yellow"
    Write-Host ""
    Write-Host "# 上传备份文件到 Ubuntu 服务器"
    Write-Host "scp -r `"$BackupDir`" user@192.168.2.183:/opt/twinsight/backup/"
    Write-Host ""
    Write-Host "# 在 Ubuntu 服务器上导入 PostgreSQL 数据"
    Write-Host "docker exec -i twinsight-postgres psql -U postgres twinsight < /opt/twinsight/backup/postgres_twinsight.sql"
    Write-Host ""
    Write-Host "# 在 Ubuntu 服务器上导入 InfluxDB 数据"
    Write-Host "docker cp /opt/twinsight/backup/influx_backup twinsight-influxdb:/tmp/"
    Write-Host "docker exec twinsight-influxdb influx restore /tmp/influx_backup --token `$INFLUX_TOKEN"
    Write-Host ""
}

# 主函数
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    Write-ColorOutput "`nTwinsight 数据迁移脚本" "Cyan"
    Write-ColorOutput "========================`n" "Cyan"
    
    # 检查 Docker
    if (-not (Test-DockerRunning)) {
        Write-ColorOutput "错误: Docker 未运行，请先启动 Docker Desktop" "Red"
        return
    }
    
    # 创建备份目录
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    Write-ColorOutput "备份目录: $BackupDir" "Cyan"
    
    $success = $true
    
    if (-not $InfluxOnly) {
        if (-not (Export-PostgreSQL)) { $success = $false }
    }
    
    if (-not $PostgresOnly) {
        if (-not (Export-InfluxDB)) { $success = $false }
    }
    
    Export-NodeRedFlows
    Export-N8nWorkflows
    
    Show-UploadInstructions
}

Main
