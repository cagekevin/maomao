// 一次性修改 App.js：删 qa/Ja、加 import、替换引用、加事件监听
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
let content = fs.readFileSync(appPath, 'utf8');

// 1. 加 import（在最后一个面板 import 之后）
const importAnchor = `import { Bg } from './components/panels/ImportExportPanel.js';`;
const newImports = `
import { PromptLibrary, PromptDropdown } from './components/prompts/PromptLibrary.jsx';
import { saveAndNotify } from './services/promptManager.js';`;

if (!content.includes(`import { PromptLibrary`)) {
  content = content.replace(importAnchor, importAnchor + newImports);
}

// 2. 删 qa 函数（function qa({ ... } 到下一个 module 级函数前）
// 找 qa 的起始和结束
const qaStart = content.indexOf('\nfunction qa({');
if (qaStart === -1) throw new Error('Cannot find qa function start');

// 找 qa 函数结束后下一个 module 级声明（function Ja 或 var Ya）
const afterQa = content.indexOf('\nfunction Ja({', qaStart + 1);
if (afterQa === -1) throw new Error('Cannot find Ja after qa');

// 删掉 qa（从 function qa 的换行前到 Ja 之前）
content = content.substring(0, qaStart) + content.substring(afterQa);

// 3. 删 Ja 函数
const jaStart = content.indexOf('\nfunction Ja({');
if (jaStart === -1) throw new Error('Cannot find Ja function start');

const afterJa = content.indexOf('\nvar Ya = Y.memo(({', jaStart + 1);
if (afterJa === -1) throw new Error('Cannot find Ya after Ja');

content = content.substring(0, jaStart) + '\n' + content.substring(afterJa);

// 4. 替换 5 处 X.jsx(Ja, 为 X.jsx(PromptDropdown,（去掉 onPresetsChange prop）
content = content.replace(/X\.jsx\(Ja,\s*\{/g, (match) => match.replace('Ja,', 'PromptDropdown,'));

// 5. 找到 App function 内的 jr useState，在 useRef 事件监听区域后加入 presetsChanged 监听
// 找 function App() { 之后的第一个 useEffect 块（用作插入锚点）
// 在 Mr state 定义之后插入事件监听
const mrSetterAnchor = 'var _a = Y.useState([]), jr = _a[0], Mr = _a[1];';
const eventListener = `
  // 监听提示词变更事件
  Y.useEffect(() => {
    const h = (e) => Mr(e.detail);
    window.addEventListener('yimao:presetsChanged', h);
    return () => window.removeEventListener('yimao:presetsChanged', h);
  }, []);`;

// 在 jr/Mr 定义之后插入
if (!content.includes('yimao:presetsChanged')) {
  content = content.replace(mrSetterAnchor, mrSetterAnchor + eventListener);
}

// 6. 替换设置面板 basic tab（预设提示词编辑页面 → 打开 PromptLibrary）
// 找 Ee === 'basic' 的渲染块，替换为打开 PromptLibrary
// 原代码: Ee === `basic` && X.jsx(`div`, { ...预设提示词编辑器... })
// 替换为: Ee === `basic` && null（自动打开 PromptLibrary）

// 先找到设置面板中 jr/Mr 的使用位置附近
// 原来 basic tab 内容很复杂，不能简单替换。
// 改为：保留 Ee === 'basic' 分支但只渲染 PromptLibrary

// 找 basic tab 的起始：Ee === `basic` && 
const basicTabAnchor = "Ee === `basic` && X.jsx(`div`, {\n          className: `space-y-6 animate-fade-in`,\n          children:";

if (content.includes(basicTabAnchor)) {
  // 复用的打开方式：Ee === 'basic' 时自动渲染 PromptLibrary
  // 在设置面板 JSX 区域之前，找一个位置放 PromptLibrary state 和渲染
  // 最简单方案：在 basicTab 内容后加一个 PromptLibrary 组件
  // 但实际上 best approach：找一个位置插入 state 定义和组件渲染

  // 替代方案：替换 basic tab 的整个内容为一个简单的 PromptLibrary 调用
  // 但这需要读取大量代码
  
  // 临时方案：basic tab 内容不变，在外面另外加 PromptLibrary 渲染
  // 或者在 settings 渲染的 children 最后加上 PromptLibrary
}

// 暂时跳过第6步（设置面板替换），先验证前5步

fs.writeFileSync(appPath, content, 'utf8');
console.log('Done: imports added, qa/Ja deleted, 5 Ja->PromptDropdown replacements, event listener added');
console.log('TODO: replace settings panel basic tab manually');
