# S1-01｜固件基础工程详细设计 V0.1（用户确认）
2026-11-26。与S0-06技术验证并行准备详细设计；未取得验证报告，尚未授权正式工程初始化、业务开发或烧录。目标实施分支为嵌入式固件，当前只归档设计至项目总管理。
依据：AGENTS V1.5、S0-08 firmware-layout.md、S0-11 firmware-memory.md、S0-22 development-plan.md及S0-06任务书。

## 初始目录
firmware/esp32/ 为独立PlatformIO工程，按需建立 platformio.ini、partitions.csv、README.md、include/、src/main.cpp、lib/exlink_core/、test/。后续按已确认目录职责随实际功能建立模块，不预生成大量空文件和无用途封装。firmware/rp2040/、firmware/ch549/ 独立构建维护，firmware/docs/保存报告；不改Studio或其他分支。
main.cpp 仅承担启动装配和调度入口，setup调用系统初始化，loop调用系统运行/适当阻塞或让出CPU（System_Init/System_Run仅为职责示意，非冻结函数名）；不堆积业务、不忙轮询。

## 三种构建环境
| 环境 | 职责 |
|---|---|
| esp32_real | 真实BSP/HAL/驱动；仅启用已核实映射，不烧录或驱动未知硬件 |
| esp32_mock | MCU上使用模拟HAL，显式模拟标识，不开启危险输出或误选真实驱动 |
| native | 主机可移植C/C++核心逻辑及单测，不依赖Arduino/FreeRTOS/LVGL或真实I/O |
按明确源文件筛选或装配规则隔离real/mock/native，避免重复定义。Native单测与后续完整LVGL PC模拟互补；不能证明MCU时序及真实硬件安全。

## 配置边界
ESP32-S3R8、16MiB Flash、8MiB PSRAM为设计目标；PlatformIO+Arduino-ESP32+FreeRTOS+C/C++，LVGL。双4MiB应用槽、双3.5MiB资源槽沿用S0-11候选，不锁定生产分区。具体board配置、依赖版本、编译选项、GPIO及电气默认态待S0-06和最终接口核查，不凭参考工程复制真实板配置。初始工程只按授权实现基础范围，不提前建立仪器功能、危险控制、网络、OTA业务或假装硬件初始化成功。每项固件任务按AGENTS双参考审计，第三方代码/资源先核授权；不提交缓存、无授权二进制、凭据。

## 验收条件（待执行）
- 可重复构建；记录实际依赖版本、环境、命令、退出状态及日志。
- real/mock/native编译与依赖正确隔离；native单元测试实际通过。
- Flash分区偏移/大小/对齐及镜像容量检查通过；生产分区仍须批准。
- 无未经授权第三方代码、编造硬件引脚、未经核实危险输出初始化。
- 配置完成后拟执行 pio run -e esp32_real、pio run -e esp32_mock、pio test -e native（在firmware/esp32/）；未实际执行不得写通过。
- 复审代码及证据，经用户确认后才标记对应任务验收完成；真实硬件验证另列待样机，不以编译通过替代。

## 状态与下一步
详细设计已获确认；S0-06A等实际结果仍待Codex交付与独立复审。S1正式实施未启动。下一项拟S1-02 BSP板级支持包详细设计，单独确认后归档。此文档不等于实施指令。
