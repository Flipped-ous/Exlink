# S0-19｜虚拟设备与模拟测试 V0.2（用户确认方向）
2026-11-26。固件级模拟为目标，简单协议模拟器作为先期联调手段；优先使用现有模拟器，避免重写底层。仅设计归档，不授权S1开工，具体工具待可行性验证。
## 现状证据
虚拟设备分支 a30e3da926e7a5a1a64da55afdb974c5ce702d91 的 simulator/README.md 仅规划；Studio分支 84e8afe858704f2622bb265c3695a2c0c9d9a92a 的 src/lib/demo.ts 四通道演示、src/core/session.ts StreamDecoder/BoundedRing/SessionEngine、src/lib/serial.ts 独立串口接口可保留，不是整机模拟器。四通道演示不等于设备示波器通道数量。固件Mock HAL仍未实现。方屏与ExlinkPro已有固件行为按S0-05及各模块复审参考；完整可复用测试工程、第三方许可仍待核。
## 三层测试
- PC协议模拟器：Python/asyncio候选，先实现已批准协议子集、稳定模拟身份、数据及故障注入，供Studio/Companion无板联调。与真实设备共用协议与测试向量，不声称复用全部C++业务。协议线上格式尚未冻结。
- PC固件级模拟：C/C++、LVGL、SDL2、CMake、Mock HAL候选；直接复用可移植业务、资源/安全状态机及LVGL页面，平台时钟、输入、显示、存储、网络等主机适配；独立环境不能等同ESP32/FreeRTOS时序。PlatformIO native测试纯业务，Python用于自动化、协议场景和故障控制。优先简单方案，不强制跨语言绑定或完整模拟芯片。
- ESP32 Mock环境：后续有开发板时运行实际MCU固件Mock HAL，构建隔离real/mock，不驱动危险硬件。真机验收另列。
## 模拟功能与界面
模拟输入/电源负载、V/I/P、正负测压、通断及带电拒绝、PWM/频率、示波器波形、I2C虚拟从机/NACK、串口数据、工作台组件与资源互斥、配置、OTA状态/模拟回滚、电池及低电量。简化物理模型和阈值明确标为模拟，不当作实际电气性能。左侧480×480设备画面（优先真实LVGL页面），右侧环境/故障控制及日志为布局候选；先无界面协议/测试，再增PC真实LVGL预览，不重画一套业务UI。所有界面简体中文且明显标识模拟。模拟ID/连接入口与实物分离；故障注入仅模拟专用接口，不进入生产设备协议或真实硬件。
## 现成工具调研（候选，尚未安装/编译）
- LVGL官方 PC Simulator https://github.com/lvgl/lv_port_pc_vscode ，Windows/Linux/macOS，SDL2/CMake、真实LVGL页面；优先验证与最终LVGL版本匹配的分支，不强制升级LVGL。https://lvgl.io/docs/open/integration/pc/windows
- Wokwi https://docs.wokwi.com/guides/esp32 ，ESP32-S3、Arduino/PlatformIO、虚拟外设/Wi-Fi及自定义芯片候选；文档Bluetooth未支持，专用CO5300/CST9220/MP28167/TLA2528模型未确认；VS Code许可及私有网关限制 https://wokwi.com/pricing ，不作为强制付费依赖。
- Espressif QEMU https://github.com/espressif/qemu ，CPU/Flash/PSRAM等仿真；官方支持矩阵 https://github.com/espressif/esp-toolchain-docs/blob/main/qemu/README.md 显示Wi-Fi、BLE、GP SPI、I2C、USB等缺口，不能完整模拟本板。
- Espressif esp-emulator https://github.com/espressif/esp-emulator/releases ，v0.43.0发布说明新增ESP32-S3及模拟Wi-Fi/BLE，USB OTG未模拟，适合作为编译后二进制仿真可行性探针；具体Arduino版本、外设、Windows运行方式、授权/源码可用性待查，不宣称为完整开源实现或已验证适配。
以上工具作为研究候选，不冻结新增依赖。没有发现可直接完整运行本板所有外设与三主控的现成模拟器；优先LVGL PC+Mock，芯片仿真补充，不重复开发指令集/外围仿真底层。
## 验收与开发边界
固定种子/注入时钟、可重复场景，测试默认关、故障关断/解除不自动启动、工具退出/工作台切换/互斥、断连/重连/重复命令、配置损坏、缓存边界、OTA失败与模拟回滚、UI生命周期。记录真实执行命令及证据，区分主机/协议/MCU模拟/实物。无法证明真实ADC精度、带宽、时序、USB/RF、PCB、电源保护、温升、续航、掉电Flash恢复；样机验收不可替代。S0-06依赖/授权/网表仍未闭环，S1未启动。实际开发由用户另行授权后交Codex，先可行性探针再正式实现。
