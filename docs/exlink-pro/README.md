# EXLINK PRO 2.0｜整机开发管理入口

状态：S0 源码审计与技术验证；ESP32 主框架已确认 Arduino-ESP32 + PlatformIO，具体版本、架构及实测尚未完成。

## 模块分支

- [硬件](https://github.com/Flipped-ous/Exlink/tree/%E7%A1%AC%E4%BB%B6%E8%AE%BE%E8%AE%A1)（硬件设计）
- [设备固件](https://github.com/Flipped-ous/Exlink/tree/%E5%B5%8C%E5%85%A5%E5%BC%8F%E5%9B%BA%E4%BB%B6)（嵌入式固件）
- [Studio](https://github.com/Flipped-ous/Exlink/tree/%E8%B0%83%E8%AF%95%E5%8A%A9%E6%89%8B)（调试助手，现有 Electron 工程）
- [Companion](https://github.com/Flipped-ous/Exlink/tree/%E6%89%8B%E6%9C%BA%E5%8A%A9%E6%89%8B)（手机助手）
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
- [阶段任务与进度](roadmap.md)

## 管理规则

每个任务记录版本、变更、依赖、遗留问题及测试证据。区分规划、代码完成、模拟测试通过和实物验证通过。最终硬件网表是 GPIO 和接口的依据。具体依赖版本须在兼容性及编译验证后冻结；已确认的 Arduino 框架不得自行变更。

当前仓库公开；内部硬件文件、采购资料、密钥及未获许可的第三方固件不纳入本次提交。

## 开发分工

ChatGPT 负责需求、架构、任务书与审查；Codex 负责代码实现、构建和测试；用户负责最终决策与硬件验收。开发前须读取全局规范及当前任务书。
