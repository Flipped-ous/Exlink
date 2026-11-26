# S0-05｜参考固件初步审计（2026-11-25）
状态：仓库及关键文件静态审查完成，完整依赖、授权、构建、硬件映射仍待验证。没有移植、编译、烧录或实测。不得将上游测试结果视作本项目验收。

## 固定参考
| 来源 | 读取时 main SHA | 证据范围 |
|---|---|---|
| [方屏改版](https://github.com/hajimi-yzy/Exlink-Tool-Square/tree/259434f5f6addb91ea0c2b1fa0ffe756d9f4d628) | 259434f5f6addb91ea0c2b1fa0ffe756d9f4d628 | README、递归目录、platformio.ini、THIRD_PARTY_NOTICES、my.csv、main.cpp、internal_i2c_service.cpp、scope_capture.cpp、mcp4017_control.h、display_geometry.h、Android Gradle、firmware/README、docs/RELEASE_1.0.24.md |
| [ExlinkPro](https://github.com/physicsexpert/ExlinkPro/tree/a04b557695003aed515300d4f3fdd2e858de81c9) | a04b557695003aed515300d4f3fdd2e858de81c9 | README、递归目录 |
| [Exlink_Tool](https://github.com/physicsexpert/Exlink_Tool/tree/88a6e710e0d1a12d1f56185e48b6f1435d02341b) | 88a6e710e0d1a12d1f56185e48b6f1435d02341b | README、递归目录 |

## 授权边界
上述仓库未在 API 元数据中提供标准 SPDX 仓库许可证；方屏 README 与原版 README 明示禁止商用、转载注明出处。方屏第三方声明保留组件各自许可，未获独立许可的代码不额外授权。不可将整个项目当 MIT/GPL 或任意可商用开源代码；未经许可不复制受限源码、资源及二进制至本公开仓库。先做行为与接口参考、独立实现；逐文件核实授权和来源，必要时征得作者许可。RP2040/CH549 二进制另核来源及分发权。

## 技术事实
方屏 README 标注固件 1.0.24、Android 0.4.0。PlatformIO espressif32 6.5.0，framework=arduino，16MB flash。CO5300 Arduino_GFX QSPI，480×480 LVGL，CST9220；internal_i2c_service 独立 FreeRTOS 任务、队列、触摸中断通知、INA 恢复；内部 I2C 默认100kHz。scope_capture 使用旧 ADC digital driver/esp_adc_cal、独立采集及释放状态。Android Kotlin/Compose，JDK17 SDK35；存在云服务配置与 BLE OTA。my.csv 两个4MiB OTA app 槽、两个3.5MiB资源槽，不能直接确定本项目分区。原版及 Pro 的可见目录包含 pico_sdk_sigrok.uf2、WCHLINK_V2.10.bin 和 ISP 安装程序，可见 GitHub 树未发现相应完整固件源码；已另行读取 ExlinkPro 资料包的 ESP32 工程，RP2040/CH549 完整源码与授权仍未核清。原版 Pro README 说明 MP28167-A 的 I2C 调压方案；方屏实现仍有 MCP4017 数字电位器逻辑，不可直接用于本项目电源。

## 迁移矩阵（建议，非冻结选型）
| 功能 | 处理方向 | 必要条件 |
|---|---|---|
| CO5300AF/QSPI、CST9220 | 优先参考显示窗口/触摸/唤醒行为，原生驱动适配或独立实现 | 正式屏幕规格、原始 PCB、SDK、地址与时序 |
| LVGL、按键、休眠 | 保留交互与状态机经验，重新组织页面与服务 | 确认 LVGL 版本、线程所有权 |
| 内部 I2C、INA226 | 参考单一总线所有者、队列、错误恢复；新 HAL | 核实共线、地址、分流参数、超时 |
| GPIO4 简易示波器 | 参考采集/释放机制；迁移至选定 SDK ADC API | 原始模拟前端、资源冲突、校准 |
| PWM、频率计、I2C扫描、无线UART/下载 | 逐项审计后适配/实现 | 外部引脚、电平、实际目标协议 |
| MP28167-A、MP5016、BQ25606、电压通断 TLA2528 | MP28167 参考原版寄存器及步进，新增安全服务、错误处理和 TLA2528 驱动；不复用 MCP4017 调压 | 官方规格、网表、保护策略、默认OFF、实测 |
| OTA | 借鉴双槽、健康检查、资源更新；重新评估分区和鉴权 | 签名/回滚/断电测试，局域网优先，不默认云依赖 |
| RP2040 | 优先调查 sigrok UF2 对应可授权源工程，独立 USB 逻辑分析 | PIO/引脚/flash/USB协议、恢复、采样测试 |
| CH549G | 核实已有 DAP/WCH/CDC 固件来源与目标芯片，独立 USB | 授权、引脚、ISP、枚举/模式与实际目标测试 |
| 手机端 | 参考 BLE 行为，Flutter 与原生 Kotlin 均待评估 | 不移植账号、收费授权或云服务为强制依赖 |
| MPU6050、AHT20 | 排除 | R4 明确不新增 |
| Studio | 保留现有 Electron | 不迁移技术栈 |

R4 GPIO45 LCD_TE、GPIO42 CONT_EN_N、TLA2528 VM_ADC_EN 与旧工程冲突；方屏 main.cpp 的 LCD_TE=45 与近期记录一致，但整机 GPIO 必须从最新原始 PCB 确认。不得原样刷写参考镜像。无 ESP32-RP2040 SPI，保留独立 USB。

## 上游已报告问题（非本项目测试）
方屏发布说明记载构建与18/18回归通过，仍有 I2C 超时及接近1s停顿、light-sleep 后 USB 日志不能自动恢复、充电线黑屏和偶发重启未复现、长期休眠待验证、INA 恢复覆盖不足。应转成新工程故障注入/回归用例，不照搬通过结论。

## 尚未完成
完整源文件和依赖许可证清单、RP2040/CH549 源码与二进制身份、最新 PCB 网表、已选 Arduino 的版本兼容性及构建、LVGL 版本、协议与架构冻结。下一步 S0-06 技术选型证据；见 tasks/S0-06-codex-feasibility.md。

## 2026-11-26 双参考复审（用户确认）
原作者资料包 EXLINK_PRO_开源参考资料_2026-06-29.zip，242169777 字节，实际读取 ExlinkPro开源资料2026_6_29/software/Exlink/ 下文件。仅记录行为和事实，不上传第三方源码。
- platformio.ini：espressif32 6.5.0、Arduino、qio_opi、BOARD_HAS_PSRAM、16MB。my.csv：15MiB factory 单槽、无双资源槽。归档的 .pio/build/esp32s3/firmware.bin 为2088400字节（未重新构建）。
- src/main.cpp 853行：79–83 320×240 半屏单缓冲；125–224 MP28167 0x60、VREF_L/H/GO、硬编码换算及0.1V步进，I2C读写缺少完整返回值检查；500 INA 电流除以4936，803 INA.begin(10,10000)，不可直接用于20mΩ新板；247/661 PWM与PCNT共GPIO5；840起 loop。
- 方屏固定SHA：main.cpp 562–584 32/16/8行内部单缓冲，4346 单缓冲初始化；4524–4569 loop 执行业务；internal_i2c_service.cpp 28–39 队列和4096字节、优先级1、Core0；scope_capture.cpp 156–210 8192字节、优先级1、Core0、ADC所有权/暂停恢复。main.cpp 4175/4681 存在恢复电源行为，不继承。my.csv 双4MiB应用、双3.5MiB资源、64KiB coredump。
- 每项固件任务先查两套参考源码，记录固定版本、文件/函数/行号、现有行为、缺陷、新板差异及授权；优先保留成熟行为并最小适配，必要时独立实现。没有源码或授权时明确缺口，不假称已读取或可复用；不为分层而重复封装或重写。方屏为主要软件技术参考，ExlinkPro 为 MP28167 等电源和原硬件工具参考。
- 上述是静态复审，不代表编译、授权、网表或真机通过。S0-06 继续验证具体依赖及回滚。
