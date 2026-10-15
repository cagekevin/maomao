# 检索命令速查（Phase 0 / 2 / 3 / 6 用）

> 默认目标结构为 `backend/services/`、`backend/api/`——**这只是默认，实际路径以 Phase -1 探测结果为准**。
> 下方给出 PowerShell 与 bash/rg 两套等价命令，按当前环境选一套。

## 一、PowerShell（Windows 默认）

```powershell
# 1. 列出所有 service 按行数排序
Get-ChildItem backend/services/ -Filter "*.py" | Sort-Object Length -Descending | ForEach-Object { 
    $lines = (Get-Content $_.FullName).Count; "$lines`t$($_.Name)" 
}

# 2. 扫所有可能调 AI 的文件
Select-String -Path backend/services/*.py -Pattern "call_llm|image_generate|video_generate" -List | ForEach-Object { 
    $_.Path.Split('/')[-1] 
}

# 3. 扫所有 SQL 操作（找 DB 流向）
Select-String -Path backend/services/*.py -Pattern "INSERT INTO|UPDATE .* SET|BEGIN IMMEDIATE" | ForEach-Object { 
    "$($_.Path.Split('/')[-1]):$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 4. 扫所有状态赋值（找状态机）
Select-String -Path backend/services/*.py -Pattern "status\s*=\s*['\"][a-z_]+['\"]" | ForEach-Object { 
    "$($_.Path.Split('/')[-1]):$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 5. 扫所有函数/class 定义（快速了解文件结构）
Select-String -Path backend/services/<filename>.py -Pattern "^async def |^def |^class " | ForEach-Object { 
    "$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 6. 扫长任务时间维度（进度/取消/超时/恢复）
Select-String -Path backend/services/*.py -Pattern "progress|cancel|abort|checkpoint|resume|restart" | ForEach-Object { 
    "$($_.Path.Split('/')[-1]):$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 7. 扫降级/兜底/重试（失败链路）
Select-String -Path backend/services/*.py -Pattern "fallback|dead_letter|retry|except .*Error|manual" | ForEach-Object { 
    "$($_.Path.Split('/')[-1]):$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 8. 扫成本/配额/限流
Select-String -Path backend/services/*.py -Pattern "quota|rate_limit|budget|cost|price" | ForEach-Object { 
    "$($_.Path.Split('/')[-1]):$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 9. 扫环境变量 / 配置（配置可复现性）
Select-String -Path backend/**/*.py -Pattern "os\.environ|getenv|BaseSettings|Settings\(" | ForEach-Object { 
    "$($_.Path.Split('/')[-1]):$($_.LineNumber)`t$($_.Line.Trim())" 
}

# 10. 找测试与 golden sample
Get-ChildItem -Recurse -Filter "test_*.py" | ForEach-Object { $_.FullName }

# 11. 扫依赖闭包（utils / core / middleware，别漏零件）
Get-ChildItem backend/utils/, backend/core/, backend/middleware/ -Recurse -Filter "*.py" | ForEach-Object { $_.FullName }
```

## 二、bash / ripgrep（macOS / Linux / Git Bash 等价）

```bash
# 1. 按行数列 service
wc -l backend/services/*.py | sort -rn

# 2. 扫所有调 AI 的文件
rg -l 'call_llm|image_generate|video_generate' backend/services/

# 3. 扫 SQL 操作（带行号）
rg -n 'INSERT INTO|UPDATE .* SET|BEGIN IMMEDIATE' backend/services/

# 4. 扫状态赋值
rg -n "status\s*=\s*['\"][a-z_]+['\"]" backend/services/

# 5. 扫函数/class 定义
rg -n '^(async def|def|class) ' backend/services/<filename>.py

# 6. 扫长任务时间维度
rg -n 'progress|cancel|abort|checkpoint|resume|restart' backend/services/

# 7. 扫降级/兜底/重试
rg -n 'fallback|dead_letter|retry|except .*Error|manual' backend/services/

# 8. 扫成本/配额/限流
rg -n 'quota|rate_limit|budget|cost|price' backend/services/

# 9. 扫环境变量 / 配置
rg -n 'os\.environ|getenv|BaseSettings|Settings\(' backend/

# 10. 找测试
find . -name 'test_*.py'

# 11. 扫依赖闭包
find backend/utils backend/core backend/middleware -name '*.py'
```
