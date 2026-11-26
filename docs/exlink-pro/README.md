# EXLINK PRO 2.0｜整机开发管理入口

状态：S0 源码审计与技术验证；ESP32 主框架已确认 Arduino-ESP32 + PlatformIO，具体版本、架构及实测尚未完成。

## 模块分支

- [硬件](https://github.com/Flipped-ous/Exlink/tree/%E7%A1%AC%E4%BB%B6%E8%AE%BE%E8%AE%A1)（硬件设计）
- [设备固件](https://github.com/Flipped-ous/Exlink/tree/%E5%B5%8C%E5%85%A5%E5%BC%8F%E5%9B%BA%E4%BB%B6)（嵌入式固件）
- [Studio](https://github.com/Flipped-ous/Exlink/tree/%E8%B0%83%E8%AF%95%E5%8A%A9%E6%89%8B)（调试助手，Electron基础工程与未验收功能原型）
- [EXLINK Mobile](https://github.com/Flipped-ous/Exlink/tree/%E6%89%8B%E6%9C%BA%E5%8A%A9%E6%89%8B)（手机助手）
- [Simulator](https://github.com/Flipped-ous/Exlink/tree/%E8%99%9A%E6%8B%9F%E8%AE%BE%E5%A4%87)（虚拟设备）
- [分支管理规范](branches.md)
- [Codex 全局开发规范](../../AGENTS.md)
- [Codex 开发任务书模板](codex-task-template.md)
- [公共协议](../../protocol/)
- [第三方参考](../../third_party/)
- [项目资料索引与最新来源](sources/README.md)
- [R4 后续决议](sources/latest-decisions.md)
- [S0-05 参考固件审计](source-audit.md)
- [S0-06 Codex Arduino 技术栈与可靠性验证任务书](tasks/S0-06-codex-feasibility.md)
- [软件架构评审稿](architecture.md)
- [S0-08 固件工程目录与依赖规范](firmware-layout.md)
- [S0-09 FreeRTOS 任务与调度设计](firmware-tasks.md)
- [S0-10 硬件资源管理](firmware-resources.md)
- [S0-11 内存与 Flash](firmware-memory.md)
- [S0-12 模块通信与事件机制](firmware-events.md)
- [S0-13 精简电源安全状态机](firmware-safety.md)
- [S0-14 设备通信协议与双无线OTA](../../protocol/device-protocol.md)
- [S0-15 LVGL与组件化联合工作台](firmware-ui.md)
- [S0-16 系统配置与数据存储](firmware-storage.md)
- [S0-17 系统启动与低功耗管理](firmware-power-management.md)
- [S0-18 OTA详细实现设计](firmware-ota.md)
- [S0-19 虚拟设备与模拟测试](simulator-design.md)
- [S0-20 EXLINK Mobile 手机助手架构](mobile-design.md)
- [S0-21 EXLINK Studio 集成架构](studio-integration.md)
- [S0-22 总体复审与开发任务拆分](development-plan.md)
- [阶段任务与进度](roadmap.md)

## 管理规则

每项固件任务先查两套参考源码，记录固定版本、文件/函数/行号、现有行为、缺陷、新板差异及授权；优先保留成熟行为并最小适配，必要时独立实现。没有源码或授权时明确缺口，不假称已读取或可复用；不为分层而重复封装或重写。方屏为主要软件技术参考，ExlinkPro 为 MP28167 等电源和原硬件工具参考。

每项设计经用户明确确认后提交，下一项单独评审。

所有用户可见界面统一简体中文，包括设备 LVGL、手机 EXLINK Mobile、电脑 Studio、虚拟设备界面、设置/系统诊断、OTA、弹窗、错误及状态提示。USB、Wi-Fi、BLE、PWM、I²C、UART 等标准缩写及品牌名称可保留；内部代码标识符、协议字段、错误码仍用英文，界面映射中文文案。集中管理文案及中文字体，嵌入式优先验证字库裁剪、缺字及内存占用；首版不额外增加多语言切换。

每个任务记录版本、变更、依赖、遗留问题及测试证据。区分需求规划、架构确认、详细设计、代码初步实现、功能测试、用户验收、正式完成；构建、模拟及实物测试证据单独记录，未通过必要验收不得标记完成。最终硬件网表是 GPIO 和接口的依据。具体依赖版本须在兼容性及编译验证后冻结；已确认的 Arduino 框架不得自行变更。

当前仓库公开；内部硬件文件、采购资料、密钥及未获许可的第三方固件不纳入本次提交。

## 开发分工

ChatGPT 负责需求、架构、任务书与审查；Codex 负责代码实现、构建和测试；用户负责最终决策与硬件验收。开发前须读取全局规范及当前任务书。

手机助手对外名称为 EXLINK Mobile（原 EXLINK Companion），工程目录仍为 companion/，中文分支名仍为手机助手；历史资料中的 Companion 指同一产品。
