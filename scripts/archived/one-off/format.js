// 运行前请先安装 prettier: npm install prettier
const prettier = require("prettier");
const fs = require("fs");

async function formatCode() {
  // 读取你的压缩代码文件
  const inputCode = fs.readFileSync("input.js", "utf8");

  try {
    // 使用 Prettier 进行格式化
    const formattedCode = await prettier.format(inputCode, {
      parser: "babel", // 使用 Babel 解析器处理 JS/React 代码
      printWidth: 80,
      tabWidth: 2,
      semi: false,
      singleQuote: true,
      trailingComma: "es5",
    });

    // 将格式化后的代码写入新文件
    fs.writeFileSync("output.js", formattedCode, "utf8");
    console.log("✅ 代码格式化成功！请查看 output.js");
  } catch (error) {
    console.error("❌ 格式化失败:", error);
  }
}

formatCode();