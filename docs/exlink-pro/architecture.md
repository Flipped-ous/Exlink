# 软件总体架构 V0.3（分层架构评审稿）

## 分工

ESP32 主固件负责设备控制、测量、UI 和通信；RP2040 独立负责逻辑分析，CH549 独立负责下载和 USB 串口。电脑通过实际 USB 设备或设备协议访问对应功能，不假设主控之间有额外数据链路。

## 技术路线

- ESP32：用户于 2026-11-26 确认 PlatformIO + Arduino-ESP32 + FreeRTOS + LVGL，C/C++；必要时使用与 Arduino Core 匹配的 ESP-IDF 原生 API。具体依赖版本仍待构建验证，不默认采用旧版或最新版，不默认迁移原生 ESP-IDF 或 Arduino Component。
- Studio：现有 Electron 工程保留；不因早期候选方案而强制迁移 Tauri。
- Companion：Flutter/Dart 候选，Android 优先。
- Simulator：固件 Mock HAL 和独立 Python 模拟服务候选。
- Protocol：统一命令、应答、状态、事件与版本；局域网优先，原生 USB 工具协议保持独立。

## 安全与测试

应用与 UI 不直接控制功率硬件；安全服务统一审核控制请求。上电、异常及升级的安全状态须定义并验证。区分模拟、编译和硬件测试，未实测不宣称性能或保护有效。

## 待解决

参考源码完整授权及依赖审查、最终硬件接口表、具体依赖版本、USB 与测量链路、第三方许可证。此文档不是生产设计或完整实现。

## OTA 与可靠性约束

采用双应用分区及原生 OTA API，校验固件签名、硬件版本、完整性和启动健康状态；验证实际 bootloader 回滚配置，不以存在 API 或双槽作为通过证据。升级前安全关闭输出及通断激励，升级后不得自动恢复危险输出；保留 USB 有线恢复、配置兼容与掉电测试。若普通 Arduino 构建无法满足安全或回滚要求，先评估可重复构建的 SDK/bootloader 配置方案；改变主框架须另行获得用户批准。


## ESP32 逻辑分层（S0-07，待评审）

| 层级 | 职责 | 边界 |
|---|---|---|
| L5 Application | LVGL 页面、按键交互、桌宠 | 只提交请求、读取状态，不直接控制硬件 |
| L4 Service | 电源、测压通断、仪器工具、通信、OTA、安全 | 统一命令校验与状态机，不绕过资源所有者 |
| L3 System | 事件、资源所有权、任务生命周期、诊断、日志、配置 | 不依赖具体 UI，不把全部控制串行化在单个事件中心 |
| L2 HAL | 统一硬件能力接口，真实与 Mock 实现 | 不依赖 UI；明确错误、有效性、时间戳 |
| L1 BSP/Driver | 板级映射及 CO5300/CST9220/MP28167/INA226/TLA2528 等驱动 | GPIO、地址、时序以最终网表及规格书为准 |
| L0 Platform | Arduino-ESP32、FreeRTOS、兼容 ESP-IDF API | 不承担产品业务逻辑 |

逻辑层不要求所有调用逐层转发；日志、诊断和事件为公共基础服务。允许直接依赖必要的低层接口，禁止循环依赖。按功能划分模块而非每个功能强制独立任务，防止任务和队列过度设计。

## 关键运行约束

- UI 单一所有者负责 LVGL API；其他任务仅发布状态、事件或命令结果。UI 不执行阻塞 I2C、网络或 Flash 操作。
- 内部 I2C 单一所有者；触摸、INA226、MP28167 和 TLA2528 的共线关系仍须核网表。有限超时、受控恢复、结果有效期与优先级；外部 I2C 与内部总线隔离。
- 电源安全服务独占危险输出控制权；硬件保护不依赖 UI 或普通消息队列及时执行。故障/复位/升级默认安全状态，禁止无确认自动恢复危险输出。具体时限与阈值待电路及风险分析。
- 外部 GPIO、UART、SPI/I2C、ADC、LEDC、PCNT 等由资源管理统一申请释放；按真实连接定义冲突组。
- Mock HAL 与真实 HAL 共享接口与业务状态机；主机模拟需明确显示模拟状态。独立 Python 模拟器是协议级模拟，不能代替真实驱动或 MCU 时序测试。
- 三颗主控保留独立维护与 USB 枚举，不假设 ESP32 与 RP2040/CH549 存在额外内部数据链路。

## OTA 实现候选（Arduino 保持不变）

Update.h 作为固件写入候选；与原生 esp_ota_* API 使用同一升级状态机，不混用多个写入所有者。Arduino-ESP32 2.0.14 官方源码具有 canRollBack/rollBack，ESP32-S3 SDK 配置启用回滚，但实际 PlatformIO 版本与 bootloader 尚未验证。参考：
- https://github.com/espressif/arduino-esp32/blob/2.0.14/libraries/Update/src/Updater.cpp
- https://github.com/espressif/arduino-esp32/blob/2.0.14/tools/sdk/esp32s3/sdkconfig
- https://github.com/espressif/arduino-esp32/blob/2.0.14/cores/esp32/esp32-hal-misc.c

检查并延后 Arduino Core 默认启动确认（该版本 verifyRollbackLater 弱符号）；由应用在健康检查通过后确认。验签及完整性验证须在激活新槽前完成；自检失败使用回滚接口，保留有线恢复。双槽存在不代表自动回滚成功。具体实现、版本、签名方案、容量、掉电与故障测试未完成。

本版本仅为设计评审稿，不锁定任务数、优先级、堆栈、GPIO、Flash 偏移或协议；不授权开始正式业务开发。

## 工程组织

参见 [S0-08 固件工程目录与依赖规范](firmware-layout.md)。目录按需建立，PlatformIO 工程根为 firmware/esp32/；纯业务逻辑可主机测试，三主控独立构建。

## FreeRTOS 任务规划

参见 [S0-09 FreeRTOS 任务与调度设计](firmware-tasks.md)。六个常驻应用任务、两个按需任务为评审起点；核心亲和性、优先级、栈、周期经实测调整。
