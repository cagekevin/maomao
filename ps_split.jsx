#target photoshop

// ps_split.jsx — 在 Photoshop 内一键把当前图分层为带图层的 PSD
// 终极完美版：双平台异步轮询架构、防死锁、相对路径稳固修正

function main() {
    if (app.documents.length === 0) {
        alert("请先打开一张图片。");
        return;
    }

    var doc = app.activeDocument;
    var isWin = $.os.indexOf("Windows") !== -1;
    var pythonCmd = isWin ? "python" : "python3";

    // 相对路径解析 (修复 ExtendScript File 构造函数拼接隐患)
    var parentDir = ($.fileName && new File($.fileName).exists)
        ? new File($.fileName).parent
        : new Folder(isWin ? "C:/Users/xinye/Documents/maomao" : "/Users/kevin/Documents/maomao");
        
    // 强制使用完整字符串拼接路径，杜绝双参数容错失效
    var scriptFile = new File(parentDir.fsName + (isWin ? "\\" : "/") + "split_server.py");
    var pyScriptPath = scriptFile.fsName;

    if (!scriptFile.exists) {
        alert("❌ 未找到 split_server.py：\n" + pyScriptPath + "\n\n请确认 split_server.py 与本 jsx 放在同一目录。");
        return;
    }

    var tempDir = Folder(Folder.temp.fsName + "/ps_split_optimized");
    if (!tempDir.exists) tempDir.create();

    var homeDir = isWin ? $.getenv("USERPROFILE") : $.getenv("HOME");
    var downloadDir = new Folder(homeDir + (isWin ? "\\Downloads" : "/Downloads"));
    if (!downloadDir.exists) downloadDir.create();

    var imagePath = tempDir.fsName + (isWin ? "\\" : "/") + "temp_poster.png";
    var psdPath   = downloadDir.fsName + (isWin ? "\\" : "/") + "split_result.psd";
    var logPath   = tempDir.fsName + (isWin ? "\\" : "/") + "split_log.txt";
    var flagPath  = tempDir.fsName + (isWin ? "\\" : "/") + "done.flag";

    // 清理历史残留文件
    var filesToClean = [imagePath, psdPath, logPath, flagPath];
    for (var i = 0; i < filesToClean.length; i++) {
        var f = new File(filesToClean[i]);
        if (f.exists) f.remove();
    }

    // 1) 导出当前文档为无损 PNG
    try {
        var dupDoc = doc.duplicate("temp_export", true);
        app.activeDocument = dupDoc;
        var pngOpts = new PNGSaveOptions();
        pngOpts.compression = 9;
        dupDoc.saveAs(new File(imagePath), pngOpts, true, Extension.LOWERCASE);
        dupDoc.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = doc;
    } catch (e) {
        alert("❌ 导出临时图片失败: " + e.message);
        return;
    }

    var areaThreshold = 1000;
    var layerMode = "normal";

    // 2) 准备执行命令
    if (isWin) {
        // Windows 批处理后台执行逻辑
        var batFile = new File(tempDir.fsName + "\\run_split.bat");
        batFile.encoding = "UTF-8";
        batFile.open("w");
        batFile.writeln("@echo off");
        batFile.writeln("chcp 65001 >nul");

        var scriptFolder = scriptFile.parent.fsName;
        batFile.writeln('cd /d "' + scriptFolder + '"');

        var wScript = scriptFile.fsName.replace(/\//g, "\\");
        var wImg    = File(imagePath).fsName.replace(/\//g, "\\");
        var wPsd    = File(psdPath).fsName.replace(/\//g, "\\");

        var cmdLine = pythonCmd + ' "' + wScript + '" "' + wImg + '"'
                    + ' --output "' + wPsd + '"'
                    + ' --area-threshold ' + areaThreshold
                    + ' --layer-mode ' + layerMode
                    + ' > "' + File(logPath).fsName + '" 2>&1';
        batFile.writeln(cmdLine);
        batFile.writeln('echo done > "' + File(flagPath).fsName + '"');
        batFile.close();

        var vbsFile = new File(tempDir.fsName + "\\run_split_silent.vbs");
        vbsFile.encoding = "UTF-8";
        vbsFile.open("w");
        vbsFile.writeln('Set WshShell = CreateObject("WScript.Shell")');
        vbsFile.writeln('WshShell.Run "cmd.exe /c ""' + batFile.fsName + '""", 0, True');
        vbsFile.close();

        vbsFile.execute();
    } else {
        // macOS 异步执行逻辑：加上 &> /dev/null & 脱离终端，防止 PS 卡死，并写入 flag
        var shellCmd = 'export PATH=\\"/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH\\"; '
                     + pythonCmd + ' \\"' + pyScriptPath + '\\" \\"' + imagePath + '\\"'
                     + ' --output \\"' + psdPath + '\\"'
                     + ' --area-threshold ' + areaThreshold
                     + ' --layer-mode ' + layerMode
                     + ' > \\"' + logPath + '\\" 2>&1 ; echo done > \\"' + flagPath + '\\"';
        
        try {
            app.system('osascript -e \'do shell script "' + shellCmd + ' &> /dev/null &"\'');
        } catch(e) {
            alert("❌ macOS 启动 Python 脚本失败，请检查 Python 环境配置。\n日志路径: " + logPath);
            return;
        }
    }

    // 3) 双平台统一轮询检测：增加 10 分钟超时保护，彻底杜绝死锁
    var flagFile = new File(flagPath);
    var maxWait = 1200; // 1200 * 500ms = 10分钟
    var waitCount = 0;
    while (!flagFile.exists && waitCount < maxWait) {
        $.sleep(500);
        waitCount++;
    }
    
    if (waitCount >= maxWait) {
        alert("❌ Python 脚本执行超时 (10分钟)！\n可能是显卡跑崩了或卡死了，请检查日志：\n" + logPath);
        return;
    }

    // 4) 打开生成的 PSD
    var psdFile = new File(psdPath);
    if (!psdFile.exists) {
        alert("❌ 分层失败！生成的 PSD 文件不存在。\n请检查日志获取详细报错信息：\n" + logPath);
        return;
    }
    
    app.open(psdFile);
    alert("🎉 图像已成功分层！");
}

app.activeDocument.suspendHistory("一键分层", "main()");