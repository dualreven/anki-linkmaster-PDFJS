#!/usr/bin/env node

/**
 * 强制使用特定的包管理器
 * 防止意外使用错误的包管理器导致依赖冲突
 */

const whichPMRuns = () => {
  const userAgent = process.env.npm_config_user_agent;
  if (!userAgent) {
    return undefined;
  }
  return pmFromUserAgent(userAgent);
};

const pmFromUserAgent = (userAgent) => {
  const pmSpec = userAgent.split(" ")[0];
  const separatorPos = pmSpec.lastIndexOf("/");
  return {
    name: pmSpec.substring(0, separatorPos),
    version: pmSpec.substring(separatorPos + 1)
  };
};

const WANTED_PM = {
  name: "pnpm",
  version: ">=7.0.0"
};

const runningPM = whichPMRuns();

if (!runningPM || runningPM.name !== WANTED_PM.name) {
  const boxWidth = 60;
  const line = "=".repeat(boxWidth);
  const spaces = " ".repeat((boxWidth - 32) / 2);

  console.log(`
${line}
${spaces}🚫 错误：包管理器限制 🚫
${line}

❌ 检测到使用了错误的包管理器: ${runningPM?.name || "npm"}

✅ 此项目必须使用 PNPM 作为包管理器

📋 正确的安装命令:
   pnpm install

🔍 原因:
   • 防止 npm 和 pnpm 混用导致的依赖冲突
   • 确保 node_modules 结构一致
   • 避免 package-lock.json 和 pnpm-lock.yaml 冲突

🔧 如果尚未安装 pnpm:
   npm install -g pnpm

${line}
`);

  process.exit(1);
}

console.log(`✅ 正在使用正确的包管理器: ${runningPM.name}@${runningPM.version}`);
