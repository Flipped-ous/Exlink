# EXLINK Studio

EXLINK PRO 配套的 Windows 调试助手，当前交付为可运行的 UI 预览。硬件通信和固件适配将在设备完成后接入。

## 启动

工作区依赖及构建资源已准备好，双击 `启动调试助手.cmd`。

从 GitHub 获取的是源码，首次运行需安装 Node.js 24 和 pnpm 11，然后在仓库目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm desktop
```

完成构建后也可双击启动脚本。依赖、编译产物、截图和运行日志不纳入 Git；变更与验证记录分别见 `CHANGELOG.md` 和 `docs/ui-validation.md`。所用 skill 的来源与版本见 `design/skills-lock.json`，不分发 skill 引擎或机器安装缓存。

开发命令：

```powershell
pnpm dev
pnpm build
pnpm desktop
```

直接检查命令：

```powershell
node --import tsx --test src/lib/*.test.ts src/core/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node node_modules/electron/cli.js desktop/verify-ui.cjs
node node_modules/electron/cli.js desktop/verify-ui.cjs --dpi=1.25
```

## 当前界面

- 左侧串口调试、逻辑分析、智能电源、工具箱，设置位于底部；没有 SWD 和辅助测量入口。
- 单行会话操作，紧凑日志、固定发送区与右侧多通道波形；窄窗口上下排列。
- 表面采用紫色液态玻璃层次，提供深浅主题及材质开关。标志采用用户最新选定的柔和紫色折带 E。
- 波形可以收起，日志随即扩展。接收继续，输入内容保留；展开与通道显隐状态自动保存。
- 四路同单位、10 Hz 本地演示；沿用最多 32 个数值通道。独立/全部显隐、当前/最小/最大值、时间窗、十字游标与框选缩放。
- 设置中可为通道标注单位并分组显示。单位标注不会换算原始值；离线文件未配置单位时按无单位数值处理。
- 搜索、方向筛选、文本/HEX、暂停显示、跟随、字节详情、JSONL 导入导出、模拟发送、行尾、指令历史和快捷指令。

导出只包含当前保留且符合筛选条件的原始日志。原始日志上限 5,000 条，数值缓存上限 20,000 帧，另有估算字节预算。清空日志保留数值缓存。

逻辑与电源页面提供配置交互和未连接状态；真实采集、输出及网络/图像工具未实现。页面中不会把演示当作真实硬件读数。当前不是安装包。

## 验证

单元测试覆盖原始字节、解析器、保留上限、降采样和偏好迁移。UI 验证使用独立 Electron 用户目录与离屏绘制帧，不操作用户正在使用的窗口，也不依赖前台桌面截图。

截图及结构化报告在 `artifacts/ui/`，包含三种窗口尺寸、深浅主题、折叠、浮层、设置、32 通道和空数据；DPI 125% 与本机 150% 另作检查。额外页面缩放测试会在报告中列出实际 viewport 与 devicePixelRatio，不混同于系统 DPI。

验收结果与交付边界见 `docs/ui-validation.md`。

## 设计记录

- `PRODUCT.md`：已确认的产品与功能边界。
- `DESIGN.md`：完成后提取的设计规则。
- `docs/ui-direction-contract.md`：本轮界面方向。
- `design/skills-lock.json`：已安装技能的来源、固定提交及引擎信息。
- `design/logo-direction.md`：最新 Logo 来源及生成提示。

本轮由 Impeccable 的操作型界面方法主导，Vercel 规范用于检查；frontend-design 已安装备用。Taste Skill 和 Designing with Impeccable 的阅读结论见 `docs/design-skills-review.md`。
