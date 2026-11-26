# S0-08｜ESP32 固件工程目录与依赖规范 V0.2（双参考复审确认）

2026-11-26；基于已确认 Arduino-ESP32 + PlatformIO + FreeRTOS + LVGL，架构 V0.4。此文件仅规划目录和职责，不代表已经建立可编译工程或授权 S1 开工。

## 三主控工程边界

`firmware/esp32/`、`firmware/rp2040/`、`firmware/ch549/` 分别独立构建、烧录和维护；`firmware/docs/` 存放跨固件报告。独立协议模拟器仍在 `simulator/`；公共协议规范在 `protocol/`（以项目总管理确认版本为准）。现有 Studio 根目录构建不改动。

## ESP32 目录（按需建立）

```text
firmware/esp32/
├── platformio.ini
├── partitions.csv
├── README.md
├── src/
│   ├── main.cpp
│   ├── app/
│   │   ├── ui/
│   │   ├── navigation/
│   │   ├── interaction/
│   │   └── pet/
│   ├── services/
│   │   ├── power/
│   │   ├── measurement/
│   │   ├── instruments/
│   │   ├── safety/
│   │   ├── communication/
│   │   └── ota/
│   ├── system/
│   │   ├── boot/
│   │   ├── tasks/
│   │   ├── events/
│   │   ├── resources/
│   │   ├── diagnostics/
│   │   ├── storage/
│   │   └── logging/
│   ├── hal/
│   │   ├── real/
│   │   └── mock/
│   ├── bsp/
│   │   ├── board/
│   │   └── buses/
│   ├── drivers/
│   │   ├── co5300/
│   │   ├── cst9220/
│   │   ├── mp28167/
│   │   ├── ina226/
│   │   └── tla2528/
│   └── platform/
├── lib/
│   └── exlink_core/
│       └── src/
├── include/
├── assets/
├── test/
├── scripts/
└── docs/
```

新增芯片/外设目录按真实需求建立，不根据芯片名称假定每颗电源芯片均需数字驱动。头文件优先与模块源码同目录；include/ 只放确需全局共享的构建配置。驱动依赖通过 PlatformIO 固定版本，第三方代码及资源授权先审查，不默认复制上游源码或整个 lib。

## 职责和依赖

- main.cpp 只负责启动装配与调度入口；setup/loop 不承担业务逻辑，loop 应阻塞等待或适当让出 CPU，不忙轮询。
- app 通过服务命令和只读状态访问功能，单一 UI 任务拥有 LVGL。不得引用具体芯片驱动或直接操作 GPIO、I2C、Flash。
- services 负责业务编排、资源申请、安全校验，调用 HAL 接口。纯状态机、单位换算、协议数据模型及校验等可移植逻辑放 lib/exlink_core/src/，由服务使用，不再重复实现同一业务。
- system 提供日志、事件、资源所有权、任务生命周期及持久化等公共接口；boot 为装配入口，可依赖各层实现。公共模块不得依赖具体 UI；不建立巨型全局事件锁或单一串行瓶颈。
- hal/ 放接口定义及 real、mock 两种实现。真实 HAL 调用 BSP/驱动；Mock HAL 模拟时钟、读数、失联、NACK、超时等。服务不直接依赖 real/mock 的具体类。
- bsp/board 集中管理经验证的板级映射；bsp/buses 负责内部 I2C 所有者、外部总线及事务控制；drivers 使用总线接口，不各自初始化/抢占同一总线。未知 GPIO 或地址不编造。
- platform 封装 SDK 版本差异、任务/时钟、低层 API 等必要接口；不为每个函数无意义再封装一次。
- exlink_core 不依赖 Arduino.h、FreeRTOS、LVGL、硬件寄存器或真实设备 I/O；用注入时钟/接口保证主机可重复测试。UI 资源源码放 assets/；生成后的编译资源或独立分区镜像按后续资源方案确定，不把 assets/ 自动视为上传文件系统。

## 编译与测试设计

PlatformIO 工程根为 firmware/esp32/，不是仓库根。建议未来建立三个用途明确的环境：esp32_real（真机，待网表）、esp32_mock（MCU 上运行模拟 HAL，不驱动危险硬件）、native（主机单测，无 Arduino/ESP32 SDK）。命名为设计建议，不能声称已存在。real/mock 环境必须使用明确 src_filter 或工厂装配规则避免重复定义或误选真实驱动；Mock 标记必须显示，默认禁止危险输出；native 只编译 portable core 及测试替身，隔离 src/ 中 MCU 专用实现。

拟验证命令（配置实现后）：在 firmware/esp32/ 执行 pio run -e esp32_real、pio run -e esp32_mock、pio test -e native。当前未运行，不提供虚假通过记录。测试可分 test/test_power、test/test_measurement、test/test_resource、test/test_protocol、test/test_ota_policy 等；故障注入、主机逻辑与实机测试分别记证据。

OTA 统一归 services/ota，启动确认归 system/boot，危险输出互锁归 services/safety。Update.h/esp_ota_* 同一写入所有者；签名校验、激活前校验、bootloader 配置、延迟确认与回滚继续遵守 V0.4；分区偏移和大小暂不锁定。不得在仓库中存储签名私钥、凭据、.pio/、本地缓存、无授权第三方镜像。版本锁定后记录可重复构建依赖、分区与 bootloader 哈希。

## 当前状态

管理分支先保存评审稿；嵌入式固件分支现有骨架 README 的 ESP-IDF 候选描述已过时，以项目总管理最新决议为准。后续经授权初始化正式工程时同步该 README、全局规则及批准的接口规范。S0-06 版本/依赖/OTA 验证、最新 PCB 网表和授权仍是阻塞项。任务、资源及内存见对应复审文档；不提前固定栈大小、优先级、核心绑定、GPIO、Flash 分区或启动正式业务开发。

## 参考模块迁移规则
每项固件任务先查两套参考源码，记录固定版本、文件/函数/行号、现有行为、缺陷、新板差异及授权；优先保留成熟行为并最小适配，必要时独立实现。没有源码或授权时明确缺口，不假称已读取或可复用；不为分层而重复封装或重写。方屏为主要软件技术参考，ExlinkPro 为 MP28167 等电源和原硬件工具参考。
方屏 internal_i2c_service、scope_capture、scope_math、device_ota_sink、ble_update_service、device_update、screen_asset、app_log、display_geometry 优先参考并按功能迁移；保留合理粒度，不重复造轮子。原版 MP28167 参考寄存器及步进，独立安全和错误处理；不得沿用 MCP4017。目录是职责规划而非强制拆分；loopTask 可作为初期 UI 所有者并运行有界非阻塞模块，不堆积业务实现。

## S0-15 页面与工作台组织
在现有 app/ui、app/navigation、app/interaction、app/pet 内按需组织可复用工具界面及轻量工作台会话管理，使用已有 services、system/resources；不另建重复驱动/业务服务或为每个工具强制创建任务。具体目录按实现需要确定，详见 firmware-ui.md。
