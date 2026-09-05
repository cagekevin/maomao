# 刷新 Windows 图标缓存（一次性工具，用完可删）
# 用途：exe 换了图标但资源管理器/托盘仍显示旧图标时，强制系统重读。
$ErrorActionPreference = "SilentlyContinue"

Write-Host "1) 清理 shell 图标缓存 (ie4uinit)..." -ForegroundColor Cyan
& ie4uinit.exe -ClearIconCache | Out-Null

Write-Host "2) 通知 Explorer 图标已变更 (SHChangeNotify)..." -ForegroundColor Cyan
$def = @"
using System;
using System.Runtime.InteropServices;
namespace MaomaoShell {
  public class Native {
    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
  }
}
"@
Add-Type -TypeDefinition $def
[MaomaoShell.Native]::SHChangeNotify(0x08000000, 0x0005, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host ""
Write-Host "✅ 图标缓存刷新命令已执行" -ForegroundColor Green
Write-Host "   若资源管理器里仍显示旧图标，请按 F5 刷新，或重开一个文件夹窗口。" -ForegroundColor DarkGray
Write-Host "   仍无效则需重启 explorer / 注销重登录（缓存会彻底重建）。" -ForegroundColor DarkGray
