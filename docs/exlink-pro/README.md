# EXLINK PRO 2.0｜整机开发管理入口

状态：S0 源码审计与技术选型；尚未完成正式软件架构冻结或整机实测。

## 模块分支

- [硬件](https://github.com/Flipped-ous/Exlink/tree/hardware)（hardware）
- [设备固件](https://github.com/Flipped-ous/Exlink/tree/firmware)（firmware）
- [Studio](https://github.com/Flipped-ous/Exlink/tree/%E8%B0%83%E8%AF%95%E5%8A%A9%E6%89%8B)（调试助手，现有 Electron 工程）
- [Companion](https://github.com/Flipped-ous/Exlink/tree/companion)（companion）
- [Simulator](https://github.com/Flipped-ous/Exlink/tree/simulator)（simulator）
- [分支管理规范](branches.md)
- [公共协议](../../protocol/)
- [第三方参考](../../third_party/)
- [软件架构初稿](architecture.md)
- [阶段任务与进度](roadmap.md)

## 管理规则

每个任务记录版本、变更、依赖、遗留问题及测试证据。区分规划、代码完成、模拟测试通过和实物验证通过。最终硬件网表是 GPIO 和接口的依据。技术选型须在依赖与编译验证后冻结。

当前仓库公开；内部硬件文件、采购资料、密钥及未获许可的第三方固件不纳入本次提交。
