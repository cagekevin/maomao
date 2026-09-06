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

func spawn(cmd: String, args: [String], cwd: String, outFile: String?, errFile: String?, extraEnv: [String: String]? = nil) -> Process {
  let p = Process()
  p.executableURL = URL(fileURLWithPath: cmd)
  p.arguments = args
  p.currentDirectoryPath = cwd
  var env = ["PATH": NODE_PATH_ENV, "HOME": NSHomeDirectory(), "LANG": "en_US.UTF-8", "LC_ALL": "en_US.UTF-8"]
  if let e = extraEnv { env.merge(e) { _, new in new } }
  p.environment = env
  if let o = outFile, let fh = FileHandle(forWritingAtPath: o) { p.standardOutput = fh } else { p.standardOutput = Pipe() }
  if let e = errFile, let fh = FileHandle(forWritingAtPath: e) { p.standardError = fh } else { p.standardError = Pipe() }
  return p
}

// MARK: - 状态
var statusItem: NSStatusItem!
var catImage: NSImage!
var catGrayImage: NSImage!
var backendProc: Process?
var intentionalStop = false

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
  DispatchQueue.main.async { statusItem.button?.image = catImage }
}
func setCrashed() {
  DispatchQueue.main.async { statusItem.button?.image = catGrayImage }
  notify(title: "\(APP_NAME)：后端已停止", msg: "服务崩溃了，点菜单「重启服务」恢复。")
}

// MARK: - 服务控制
func startBackend() {
  intentionalStop = false
  killPort() 
  // NO_OPEN_BROWSER=1：让后端 index.ts 不自开普通浏览器标签，
  // 改由本工具在端口就绪后用 openCanvas()（优先唤醒已装 PWA）打开画布。
  let p = spawn(cmd: npmExec(), args: ["start"], cwd: LT_DIR, outFile: BACKEND_LOG, errFile: BACKEND_ERR_LOG,
                extraEnv: ["NO_OPEN_BROWSER": "1"])
  p.terminationHandler = { proc in
    if !intentionalStop { setCrashed() }
  }
  backendProc = p
  try? p.run()
  
  DispatchQueue.global(qos: .userInitiated).async {
    var ok = false
    for _ in 0..<50 { 
      if portAlive() { ok = true; break }
      Thread.sleep(forTimeInterval: 0.5)
    }
    if ok {
      setHealthy()
      openCanvas() // 端口就绪后打开一次画布（优先 PWA）
    } else {
      setCrashed()
      notify(title: "\(APP_NAME)：启动失败", msg: "后端未起来，请点「Build 后端」。")
    }
  }
}

func stopBackend() {
  intentionalStop = true
  // 修复：先尝试优雅关闭，给进程一点时间清理资源
  backendProc?.terminate()
  
  // 给进程 0.5 秒的清理时间，如果还在运行则强杀
  let group = DispatchGroup()
  group.enter()
  DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
      if let pid = backendProc?.processIdentifier, backendProc?.isRunning == true {
          kill(pid, SIGKILL)
      }
      group.leave()
  }
  group.wait()
  
  backendProc = nil
  killPort()
  intentionalStop = false
}

func restartBackend() {
  stopBackend()
  startBackend()
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
  notify(title: "\(APP_NAME)：开始编译 \(label)", msg: "编译中…")
  let p = spawn(cmd: npmExec(), args: ["run", "build"], cwd: cwd, outFile: logPath, errFile: logPath)
  p.terminationHandler = { proc in
    DispatchQueue.main.async {
      if proc.terminationStatus == 0 {
        notify(title: "\(APP_NAME)：\(label) 编译成功", msg: "已重新拉起后端以加载新代码。")
        restartBackend()
      } else {
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

// MARK: - 单实例
func alreadyRunning() -> Bool {
  guard let txt = try? String(contentsOfFile: LOCK_PATH, encoding: .utf8),
        let pid = Int32(txt.trimmingCharacters(in: .whitespacesAndNewlines)), pid > 0 else { return false }
  return kill(pid, 0) == 0
}
func writeLock() {
  try? "\(ProcessInfo.processInfo.processIdentifier)".write(toFile: LOCK_PATH, atomically: true, encoding: .utf8)
}

// MARK: - 菜单与 AppDelegate (修复 Dock 交互)
class MenuController: NSObject {
  @objc func actOpen(_ s: Any) { openCanvas() }
  @objc func actBuildFront(_ s: Any) { buildFrontend() }
  @objc func actBuildBack(_ s: Any) { buildBackend() }
  @objc func actRestart(_ s: Any) { restartBackend() }
  @objc func actLog(_ s: Any) {
    let url = URL(fileURLWithPath: BACKEND_ERR_LOG)
    NSWorkspace.shared.activateFileViewerSelecting([url])
  }
  @objc func actQuit(_ s: Any) { NSApp.terminate(nil) }
}
let menuController = MenuController()

// 实现 Application Delegate 处理生命周期和 Dock 点击
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        requestNotificationPermission()
        startBackend()
    }
    
    // 当用户点击 Dock 栏图标时，再次打开画布（优先唤醒已装 PWA）
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openCanvas()
        return true
    }
    
    // 退出前清理
    func applicationWillTerminate(_ notification: Notification) {
        stopBackend()
        try? FileManager.default.removeItem(atPath: LOCK_PATH)
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
if alreadyRunning() {
  notify(title: "\(APP_NAME)", msg: "已在运行，无需重复打开。")
  exit(0)
}
writeLock()

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate 
app.setActivationPolicy(.regular) // 设置为 regular 会显示在 Dock

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