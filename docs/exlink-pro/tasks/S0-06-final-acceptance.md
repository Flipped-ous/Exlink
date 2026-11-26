# S0-06｜最终技术可行性阶段验收（用户确认）
2026-11-26。用户批准阶段性技术验收及S1无样机基础工程实施；不等于S0全部硬件/授权风险关闭，不授权S2/S3业务、S4最终UI、真实危险驱动、烧录、发布或跨分支合并。

## 审查证据
用户交付 S0-06-final-review.zip，SHA-256 e727827523eda4c2a4e3e2e3f6e1ea1ed2a020ab2ad557a18b35840c338427de；34个文件，unzip -t通过。独立读取B/C/D/E报告、dependency-versions.md、source-license-review.md、known-issues.md、实际日志及C探针源码/配置/分区CSV；核对A内附两份构建日志。交付包含报告、脱敏日志和原创探针，未含完整SDK、参考源码与实际ELF/BIN，不能独立重编或对镜像重算摘要。原包不提交公开仓库。日志属于Codex交付证据，非ChatGPT本机重新构建结果。
| 目标 | PIO静态RAM B | PIO Flash B | BIN B（交付记录） | 最终日志退出码 |
|---|---:|---:|---:|---:|
| A Arduino baseline | 18552 | 261125 | 未在此表复核 | 0 |
| A LVGL | 68360 | 298649 | 未在此表复核 | 0 |
| B ExlinkPro | 125344 | 2088481 | 2088848 | 0 |
| B Square | 64152 | 2531233 | 2531648 | 0 |
| C target | 69408 | 366165 | 366528 | 0 |
| C target-radio | 114120 | 1322689 | 1323056 | 0 |
依据logs/S0-06B-exlinkpro.log、S0-06B-square.log、S0-06B-artifacts.log、S0-06C-target.log、S0-06C-radio-audit.log及evidence/S0-06A两日志。A LVGL注册表首次失败后同版本官方归档成功；C Update重载首次失败修正后两环境通过。原版25条、方屏15条告警据B报告，不能忽略新工程的告警；原版DMA能力和Wire重载、供应商宏、LVGL const、UART空返回需处理。静态RAM不等于运行时余量。

## 第一阶段开发基线（非生产发布）
PlatformIO Core 6.1.18；espressif32@6.5.0；Arduino-ESP32 2.0.14（3.20014.231204）；随包ESP-IDF 4.4.6、FreeRTOS 10.4.3；Xtensa GCC 8.4.0+2021r2-patch5；LVGL官方8.2.0（归档SHA-256 ea59ab882ffeafd50eb5e759fe045197840da1d72c47bceef292cbbe9d9e6208，为交付报告记录，实际归档未包含在本包）。可重复获取并校验依赖，未获得则报告受阻，不隐式升级；新版本/安全维护发版前复审。espressif32 6.12.0/Arduino2.0.17/IDF4.4.7仅静态备选，未构建。保持Arduino框架。
16MiB Flash/8MiB Octal PSRAM设计目标；采用C candidate.csv为S1开发基线（不是量产分区发布）：nvs 0x9000/0x5000、otadata 0xe000/0x2000、phy_init 0x10000/0x1000、ota_0 0x20000/0x400000、ota_1 0x420000/0x400000、assets_a 0x820000/0x380000、assets_b 0xba0000/0x380000、coredump 0xf20000/0x10000；尾部0xd0000即832KiB。C报告及镜像日志记录16MiB镜像头、分区MD5/对齐/无重叠、Octal SDK配置。实际镜像头DIO，配置模板qio_opi；不得将其解释为实际Flash/PSRAM运行通过。无线探针BIN距4MiB槽余2871248B；方屏余1662656B。显示32/16/8行RGB565单缓冲30/15/7.5KiB；实际DMA最大连续块、8MiB PSRAM、并发峰值未执行，不扩大硬件。

## OTA
交付C镜像审计日志记录bootloader回滚NEW/PENDING_VERIFY/ABORTED分支及强符号verifyRollbackLater延迟确认链接；原生esp_ota_*优先，Arduino Update备选。独立检查C探针仅保留链接符号，未在板上写入或运行签名校验。
ChatGPT本轮真实重跑：将29字节合成测试载荷写入临时文件，执行 python probes/S0-06C/ota_host_check.py /tmp/exlink-test-image.bin（OpenSSL 3.5.5），7/7 PASS：合法备用槽、篡改载荷/清单、错误公钥/目标、超槽长、当前槽。测试载荷SHA-256 8a7667261166befdccc84d1d87756950726c095e593088ca44c2617f1a1130b6。原报告以366528B镜像执行OpenSSL3.5.7七项测试；本轮没有原镜像，合成载荷结果仅验证宿主机门槛。探针不覆盖完整清单解析、硬件/资源类型、设备端签名信任根、Flash写入、真实健康确认及断电/双槽损坏/USB恢复；S5细化签名格式、密钥、反降级和恢复策略，S7实测。未经授权不烧eFuse。

## 独立主控与授权
RP2040原UF2据D报告与历史Rev2上游5fb9bb7ee1912314266e5fc3aa9a0b0626d3bc62的发布二进制SHA一致；历史及维护候选9b7d1442be236d38c87959eb1475ce17a6e2cdd9构建日志最终退出0；Pico SDK2.1.0、TinyUSB5217cee5de4cd555018da90f9f1bcc87fb1c1d3a。采用维护版作为8路开发候选，非已经生成新UF2或通过PulseView。PICO_NO_PICOTOOL=1，UF2重新封装、实际USB/通道/双字节编码/速率/BOOTSEL待验。sigrok-pico GPLv3，分发须满足许可证及对应源码义务。
CH549独立CDC探针CH55xDuino0.0.26（experimental）/SDCC4.2.2，包装脚本首次失败修正后退出0；程序4052B、动态内存统计98B。仅byte echo编译，不等于G封装、目标UART、CDC运行或DAP/WCH通过。WCH-Link V2.10完整源码及许可受阻，保留功能追踪，独立解决，不阻塞ESP32 S1。不分发原BIN/安装器。双参考非商业/署名限制及定制代码无明确全项目许可，行为参考、逐文件确认或独立实现；INA库GPLv3等单独核查，不默认整包复制。

## 阶段裁决
S0-06A/B/C的交付证据阶段通过；D的历史/维护版RP2040构建和CDC探针编译通过，DAP/WCH、实际互通/授权部分受阻；E综合阶段性通过。用户授权S1基础工程无样机实施，冻结上述首阶段ESP32依赖与开发分区，不授权生产引脚及真实外设、安全阈值或生产发布。S0总体遗留P0（最终网表、R28/保护/负压及关断、许可、真实OTA签名/断电/回滚/USB恢复）保持开放。S4详细UI暂缓，设计线先S5；S1任务书见S1-codex-foundation-implementation.md。S1未实际实施或验收；后续取得代码/证据并独立复审。此前历史状态记录不覆盖本次授权。
