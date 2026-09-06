// =====================================================================
// 猫猫画布 — 常驻菜单栏 / Dock 工具 (原生 Swift)
// 修复版：现代通知 API、支持 Dock 点击、优雅关闭进程、动态路径
// =====================================================================
import Cocoa
import Foundation
import UserNotifications // 引入现代通知框架

// MARK: - 配置 (动态获取主目录，不再硬编码用户名)
let HOME = NSHomeDirectory()
let PROJECT_DIR = (HOME as NSString).appendingPathComponent("Documents/maomao")
let LT_DIR = (PROJECT_DIR as NSString).appendingPathComponent("localTool")
let LT_PORT = 18080
let CANVAS_URL = "http://127.0.0.1:\(LT_PORT)"
let APP_NAME = "猫猫画布"
// Chrome 安装的 PWA 独立应用路径（含空格用 fileURL 处理）。若用户未装，则退回普通浏览器标签。
let CHROME_PWA_APP = (HOME as NSString).appendingPathComponent("Applications/Chrome Apps.localized/猫猫画布.app")
let LOCK_PATH = "/tmp/maomao_launcher.lock"
let BACKEND_LOG = (LT_DIR as NSString).appendingPathComponent("localtool_18080.log")
let BACKEND_ERR_LOG = (LT_DIR as NSString).appendingPathComponent("localtool_18080.err.log")
let FRONTEND_BUILD_LOG = (PROJECT_DIR as NSString).appendingPathComponent(".maomao_frontend_build.log")
let BACKEND_BUILD_LOG = (LT_DIR as NSString).appendingPathComponent(".maomao_backend_build.log")

// MARK: - Node 路径
func resolveNodePaths() -> [String] {
  var dirs: [String] = []
  // 动态指向当前用户的 .local 目录
  let base = (HOME as NSString).appendingPathComponent(".local/share/fnm/node-versions")
  if let subs = try? FileManager.default.contentsOfDirectory(atPath: base) {
    let versions = subs.filter { $0.hasPrefix("v") }.sorted { a, b in
      if a == "v22.23.2" { return true }
      if b == "v22.23.2" { return false }
      return a > b
    }
    for v in versions {
      let bin = (base as NSString).appendingPathComponent("\(v)/installation/bin")
      if FileManager.default.fileExists(atPath: (bin as NSString).appendingPathComponent("node")) {
        dirs.append(bin)
      }
    }
  }
  dirs.append(contentsOf: ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"])
  return dirs
}
let NODE_PATHS = resolveNodePaths()
let NODE_PATH_ENV = (NODE_PATHS + ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]).joined(separator: ":")
func npmExec() -> String { (NODE_PATHS[0] as NSString).appendingPathComponent("npm") }

// MARK: - 进程工具
func portAlive() -> Bool {
  let p = Process()
  p.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
  p.arguments = ["-tiTCP:\(LT_PORT)", "-sTCP:LISTEN"]
  let out = Pipe()
  p.standardOutput = out
  p.standardError = Pipe()
  try? p.run()
  p.waitUntilExit()
  let d = out.fileHandleForReading.readDataToEndOfFile()
  let s = String(data: d, encoding: .utf8)?.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines) ?? ""
  return !s.isEmpty
}

func killPort() {
  let p = Process()
  p.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
  p.arguments = ["-tiTCP:\(LT_PORT)", "-sTCP:LISTEN"]
  let out = Pipe()
  p.standardOutput = out
  p.standardError = Pipe()
  try? p.run(); p.waitUntilExit()
  let d = out.fileHandleForReading.readDataToEndOfFile()
  let s = String(data: d, encoding: .utf8)?.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines) ?? ""
  if !s.isEmpty {
    for line in s.split(separator: "\n") {
      if let pid = Int32(String(line)) { kill(pid, SIGKILL) }
    }
  }
}

// 打开（必要时创建）一个文件句柄用于子进程 stdout/stderr 重定向。
// 关键：FileHandle(forWritingAtPath:) 在文件不存在时会返回 nil 导致输出丢失，
// 所以这里先确保文件存在（createFile 会创建空文件）再打开。
func fileHandleForLog(_ path: String) -> FileHandle? {
  if !FileManager.default.fileExists(atPath: path) {
    FileManager.default.createFile(atPath: path, contents: nil)
  }
  return FileHandle(forWritingAtPath: path)
}

func spawn(cmd: String, args: [String], cwd: String, outFile: String?, errFile: String?, extraEnv: [String: String]? = nil) -> Process {
  let p = Process()
  p.executableURL = URL(fileURLWithPath: cmd)
  p.arguments = args
  p.currentDirectoryPath = cwd
  var env = ["PATH": NODE_PATH_ENV, "HOME": NSHomeDirectory(), "LANG": "en_US.UTF-8", "LC_ALL": "en_US.UTF-8"]
  if let e = extraEnv { env.merge(e) { _, new in new } }
  p.environment = env
  // 用“追加写”确保多次运行日志不会被覆盖丢历史
  if let o = outFile, let fh = fileHandleForLog(o) { p.standardOutput = fh } else { p.standardOutput = Pipe() }
  if let e = errFile, let fh = fileHandleForLog(e) { p.standardError = fh } else { p.standardError = Pipe() }
  return p
}

// MARK: - 状态
var statusItem: NSStatusItem!
var catImage: NSImage!
var catGrayImage: NSImage!
var backendProc: Process?
var intentionalStop = false
// 菜单栏状态文字：让用户不依赖系统通知也能看到当前动作/后端健康度。
var statusLabel = "" {
  didSet {
    DispatchQueue.main.async {
      refreshStatusItem()
    }
  }
}

func refreshStatusItem() {
  guard let btn = statusItem?.button else { return }
  btn.image = isHealthy ? catImage : catGrayImage
  btn.title = statusLabel
}
// 当前是否健康（后端端口在线且非“编译中”）
var isHealthy = false

func grayscale(_ image: NSImage) -> NSImage {
  guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return image }
  let ci = CIImage(cgImage: cg)
  guard let f = CIFilter(name: "CIColorMonochrome") else { return image }
  f.setValue(ci, forKey: kCIInputImageKey)
  f.setValue(CIColor(red: 0.5, green: 0.5, blue: 0.5), forKey: kCIInputColorKey)
  f.setValue(1.0, forKey: kCIInputIntensityKey)
  guard let out = f.outputImage, let cgout = CIContext().createCGImage(out, from: ci.extent) else { return image }
  return NSImage(cgImage: cgout, size: image.size)
}

func setHealthy() {
  isHealthy = true
  statusLabel = ""
}
func setBusy(_ text: String) {
  isHealthy = true
  statusLabel = text
}
func setCrashed() {
  isHealthy = false
  statusLabel = "⚠"
  notify(title: "\(APP_NAME)：后端已停止", msg: "服务崩溃了，点菜单「重启服务」恢复。")
}
// 仅标记“编译失败”的菜单栏状态（不误报后端崩溃，不清除后端运行中的图标）。
func setBuildFailed() {
  isHealthy = false
  statusLabel = "✗"
}
// 兼容旧名：编译失败用 buildFailed，不用真崩溃图标/通知。
func setCrashedIconOnly() { setBuildFailed() }

// MARK: - 服务控制
func startBackend(silent: Bool = false) {
  intentionalStop = false
  killPort() 
  // NO_OPEN_BROWSER=1：让后端 index.ts 不自开普通浏览器标签，
  // 改由本工具在端口就绪后用 openCanvas()（优先唤醒已装 PWA）打开画布。
  let p = spawn(cmd: npmExec(), args: ["start"], cwd: LT_DIR, outFile: BACKEND_LOG, errFile: BACKEND_ERR_LOG,
                extraEnv: ["NO_OPEN_BROWSER": "1"])
  p.terminationHandler = { proc in
    // 后端是“服务型”长驻进程：只有在非主动停止、非“被 build 重启接管”时才标记崩溃。
    if !intentionalStop && !isRestarting { setCrashed() }
  }
  backendProc = p
  try? p.run()
  if !silent { setBusy("启动…") }
  
  DispatchQueue.global(qos: .userInitiated).async {
    var ok = false
    for _ in 0..<50 { 
      if portAlive() { ok = true; break }
      Thread.sleep(forTimeInterval: 0.5)
    }
    if ok {
      setHealthy()
      if !silent { openCanvas() } // 手动启动才自动开画布；build 后的重启不打扰
    } else {
      setCrashed()
      notify(title: "\(APP_NAME)：启动失败", msg: "后端未起来，请点「Build 后端」。")
    }
  }
}

var isRestarting = false

func stopBackend() {
  intentionalStop = true
  if let p = backendProc, p.isRunning {
    p.terminate()          // 先优雅关闭
    // 最多等 3 秒退出，超时则强杀，避免卡住退出流程
    var waited = 0.0
    while p.isRunning && waited < 3.0 {
      Thread.sleep(forTimeInterval: 0.1)
      waited += 0.1
    }
    if p.isRunning { kill(p.processIdentifier, SIGKILL) }
  }
  backendProc = nil
  killPort()
  intentionalStop = false
}

// 重启后端：在后台执行，不阻塞菜单栏 UI。
func restartBackend() {
  if isRestarting { return }
  isRestarting = true
  setBusy("重启…")
  DispatchQueue.global(qos: .userInitiated).async {
    // 先杀干净旧进程/端口
    if let p = backendProc, p.isRunning { p.terminate() }
    backendProc = nil
    killPort()
    intentionalStop = false
    // 再启动新代码
    startBackend(silent: true)
    DispatchQueue.main.async {
      isRestarting = false
    }
  }
}

// 打开画布：优先唤醒已安装的 Chrome PWA 独立应用（不挤浏览器标签），
// 未安装时退回普通浏览器标签打开 http://127.0.0.1:18080。
func openCanvas() {
  let pwa = URL(fileURLWithPath: CHROME_PWA_APP)
  if FileManager.default.fileExists(atPath: CHROME_PWA_APP) {
    NSWorkspace.shared.open(pwa)
  } else if let url = URL(string: CANVAS_URL) {
    NSWorkspace.shared.open(url)
  }
}

// MARK: - Build
func buildIn(_ cwd: String, logPath: String, label: String) {
  // 启动新 build 前清空上一次的日志，避免误读旧内容
  try? FileManager.default.removeItem(atPath: logPath)
  notify(title: "\(APP_NAME)：开始编译 \(label)", msg: "编译中…")
  setBusy("编译\(label)…")
  let p = spawn(cmd: npmExec(), args: ["run", "build"], cwd: cwd, outFile: logPath, errFile: logPath)
  p.terminationHandler = { proc in
    DispatchQueue.main.async {
      if proc.terminationStatus == 0 {
        setHealthy()
        notify(title: "\(APP_NAME)：\(label) 编译成功", msg: "已重新拉起后端以加载新代码。")
        if label == "后端" {
          // 后端构建成功必须重启服务以加载新代码（后台执行，不阻塞 UI）
          restartBackend()
        }
      } else {
        setCrashedIconOnly()
        notify(title: "\(APP_NAME)：\(label) 编译失败", msg: "详见日志：\(logPath)")
      }
    }
  }
  try? p.run()
}

func buildFrontend() { buildIn(PROJECT_DIR, logPath: FRONTEND_BUILD_LOG, label: "前端") }
func buildBackend() { buildIn(LT_DIR, logPath: BACKEND_BUILD_LOG, label: "后端") }

// MARK: - 现代系统通知 (修复废弃 API)
func requestNotificationPermission() {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, error in }
}

func notify(title: String, msg: String) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = msg
    content.sound = .default
    
    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request)
}

// MARK: - 单实例（用 flock 文件锁做真正的原子互斥，杜绝 PID 复用误判与竞态双开）
// open/flock/ftruncate/close 等来自 Darwin，已由 Cocoa/Foundation 引入。

// 持有锁的文件描述符；进程生命周期内保持打开即持有锁。
var lockFD: Int32 = -1

// 尝试获取排他锁（原子操作，由内核保证同一时间仅一个进程能持有）。
// 返回 true 表示成功获得锁（本进程是唯一实例）。
// 返回 false 表示锁已被占用（已有实例在运行）。
func acquireSingleInstanceLock() -> Bool {
  // 打开（必要时创建）锁文件
  let fd = open(LOCK_PATH, O_CREAT | O_RDWR | O_CLOEXEC, 0o644)
  if fd < 0 { return false }
  // 非阻塞尝试加排他锁：已有实例持锁时会立即失败返回 EWOULDBLOCK
  if flock(fd, LOCK_EX | LOCK_NB) != 0 {
    close(fd)
    return false   // 锁被占用，说明已有实例
  }
  // 成功持锁：把 PID 写入（便于调试/诊断），截断旧内容
  let pidStr = "\(ProcessInfo.processInfo.processIdentifier)\n"
  ftruncate(fd, 0)
  pidStr.withCString { _ = write(fd, $0, pidStr.utf8.count) }
  fsync(fd)
  lockFD = fd
  return true
}

// 释放锁（退出时调用）。进程正常结束也会自动释放。
func releaseSingleInstanceLock() {
  if lockFD >= 0 {
    flock(lockFD, LOCK_UN)
    close(lockFD)
    lockFD = -1
  }
}

// MARK: - 菜单与 AppDelegate (修复 Dock 交互)
class MenuController: NSObject {
  @objc func actOpen(_ s: Any) { openCanvas() }
  @objc func actBuildFront(_ s: Any) { buildFrontend() }
  @objc func actBuildBack(_ s: Any) { buildBackend() }
  @objc func actRestart(_ s: Any) { restartBackend() }
  @objc func actLog(_ s: Any) {
    // 确保日志文件存在，否则先创建空文件。
    // 优先打开后端运行日志（stdout），若不存在则退回错误日志。
    let primary = BACKEND_LOG
    let fallback = BACKEND_ERR_LOG
    let target = FileManager.default.fileExists(atPath: primary) ? primary : fallback
    let url = URL(fileURLWithPath: target)
    if !FileManager.default.fileExists(atPath: target) {
      FileManager.default.createFile(atPath: target, contents: nil)
    }
    // 用默认关联应用（Console / 文本编辑器）打开日志，比 Finder 选中更可靠。
    NSWorkspace.shared.open(url)
  }
  @objc func actQuit(_ s: Any) { NSApp.terminate(nil) }
}
let menuController = MenuController()

// 实现 Application Delegate 处理生命周期和 Dock 点击，并添加通知代理
class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. 设置通知代理为自身，接管前台通知行为
        UNUserNotificationCenter.current().delegate = self
        requestNotificationPermission()
        startBackend()
    }
    
    // 2. 添加此代理方法：强制在应用处于前台时展示通知横幅
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // 允许展示横幅并播放声音
        completionHandler([.banner, .sound])
    }
    
    // 当用户点击 Dock 栏图标时，再次打开画布（优先唤醒已装 PWA）
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openCanvas()
        return true
    }
    
    // 退出前清理
    func applicationWillTerminate(_ notification: Notification) {
        stopBackend()
        releaseSingleInstanceLock()
    }
}

func buildMenu() -> NSMenu {
  let m = NSMenu()
  let open = NSMenuItem(title: "打开画布", action: #selector(MenuController.actOpen), keyEquivalent: "")
  let bf = NSMenuItem(title: "Build 前端", action: #selector(MenuController.actBuildFront), keyEquivalent: "")
  let bb = NSMenuItem(title: "Build 后端", action: #selector(MenuController.actBuildBack), keyEquivalent: "")
  let rs = NSMenuItem(title: "重启服务", action: #selector(MenuController.actRestart), keyEquivalent: "")
  let log = NSMenuItem(title: "查看日志", action: #selector(MenuController.actLog), keyEquivalent: "")
  let quit = NSMenuItem(title: "退出", action: #selector(MenuController.actQuit), keyEquivalent: "q")
  [open, bf, bb, rs, log, quit].forEach { $0.target = menuController; m.addItem($0) }
  return m
}

// MARK: - 入口
if !acquireSingleInstanceLock() {
  // 已有实例在运行（flock 排他锁被占用），礼貌提示后退出。
  notify(title: "\(APP_NAME)", msg: "已在运行，无需重复打开。")
  exit(0)
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate 
// .accessory（LSUIElement/agent）：纯菜单栏形态 —— 无 Dock 图标、不出现在 Cmd+Tab 切换器，
// 只在顶部菜单栏显示猫猫图标。绝大多数 macOS 菜单栏工具（输入法/网速监控等）都用此形态。
app.setActivationPolicy(.accessory)

// 修复图片加载方式：优先使用安全的方法加载资源
if let path = Bundle.main.path(forResource: "menubar", ofType: "png") {
    catImage = NSImage(contentsOfFile: path) ?? NSImage()
} else {
    // 兼容你的备用方案
    catImage = NSImage(contentsOfFile: (Bundle.main.resourcePath ?? "") + "/menubar.png") ?? NSImage()
}
catImage.size = NSSize(width: 20, height: 20)
catGrayImage = grayscale(catImage)
catGrayImage.size = NSSize(width: 20, height: 20)

statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
if let btn = statusItem.button {
  btn.image = catImage
  btn.image?.isTemplate = false
}
statusItem.menu = buildMenu()

app.run()