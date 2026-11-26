# S5-01｜无线连接及设备发现 V0.2（用户确认）
2026-11-26。依据S0-14、S1-09、S0-20、S0-21及S3-D。仅连接方式及产品方向确认，不授权S5实施；S4详细UI暂缓。用户补充技术选项以可靠性为首要要求。

## 连接方式
- Wi-Fi主用：STA局域网及设备AP热点。局域网mDNS自动发现，取消手动输入IP/端口入口；热点不依赖互联网，亦须认证。AP/STA切换、并存、热点口令、恢复及省电策略待核。
- BLE GATT：附近发现、首次本机授权、Wi-Fi配网、基础控制与查看、无线串口及备用OTA。高频波形、大量串口数据和大文件优先Wi-Fi。BLE管理/桥接并发及Windows/手机兼容待验证。
- USB：独立RP2040和CH549原生工具协议；ESP32 USB管理待实际连线及SDK核实，HUB不是跨MCU总线。核心调试无自建服务器、云账号或互联网依赖。
- 首次手机扫描、选择设备、本机确认配对、选择Wi-Fi或热点、鉴权、读取真实能力和状态。可信设备后续自动发现并认证重连，IP变化自动重新发现；mDNS失败时优先尝试经已认证BLE获取当前网络地址/服务信息（候选，需验证平台支持），仍不可达时引导连接设备AP热点；无BLE能力的电脑依靠mDNS或设备热点。局域网隔离/防火墙不能靠获取IP解决，不执行无边界扫描或绕过认证。IP仅用于内部通信及只读诊断，不要求用户填写；电脑安全首次授权路径待S5-02。设备名/IP/BLE地址/mDNS不作为信任凭据。
- 手机、电脑、本机原则可并行，设备权威、同服务串行控制、安全优先、资源互斥、会话归属；普通断连不关闭正常输出，取消过期请求，重连同步不重放危险操作。实际并发上限待验证。

## 可靠性优先的技术候选（具体组合未冻结）
优先使用已锁定开发基线 Arduino-ESP32 2.0.14/ESP-IDF 4.4.6 中成熟官方组件，少引入依赖，不为新版本而迁移。可靠性、安全、可维护性、资源及效率综合裁决；发版前复审安全维护状态，必要升级单独确认。
本轮直接查阅上游 https://github.com/espressif/arduino-esp32/blob/2.0.14/tools/sdk/esp32s3/sdkconfig ，确认 CONFIG_BT_BLUEDROID_ENABLED=y、CONFIG_BT_NIMBLE_ENABLED未启用、CONFIG_BT_BLE_SMP_ENABLE=y、CONFIG_HTTPD_WS_SUPPORT=y、CONFIG_ESP_HTTPS_SERVER_ENABLE=y、CONFIG_ESP32_WIFI_SW_COEXIST_ENABLE=y、CONFIG_MBEDTLS_SSL_PROTO_TLS1_2=y、CONFIG_MDNS_MAX_SERVICES=10。此为上游配置证据，不代表实际安装包已核验或所有模块已联调。
优先候选Arduino WiFi及原生事件、SDK Bluedroid BLE、官方Provisioning（具体安全模式待S5-02验证）、mDNS、esp_http_server WebSocket、esp_https_server的WSS/HTTPS、mbedTLS、NVS、原生esp_ota_*。HTTP/WebSocket为应用协议，不允许未经认证的明文危险控制或凭据传输。TLS设备身份、证书验证、首次可信配对及密钥存储待S5-02；不自造加密协议，不关闭证书检查。HTTPS官方文档提示SSL连接内存开销（https://docs.espressif.com/projects/esp-idf/en/v4.4.6/esp32s3/api-reference/protocols/esp_https_server.html），实际峰值堆/连续块、握手、并发及OTA压力测试后决定容量与是否需要经批准备选。独立有界二进制数据流的线级格式待S5-03/04。具体依赖组合需兼容性证据及用户确认，不能直接宣称最可靠或正式冻结。

## 双参考与验收
本轮直接复核项目protocol/device-protocol.md、mobile-design.md、studio-integration.md及上述官方配置/文档。方屏固定SHA259434f5f6addb91ea0c2b1fa0ffe756d9f4d628的docs/BLE_UPDATE_PROTOCOL.md、docs/BLE_SERIAL_TEST.md、main.cpp 99–101/2325–2353/2452起及手机BleClient.kt为既有审计；原版ExlinkPro固定README a04b557695003aed515300d4f3fdd2e858de81c9的BLE串口为既有参考。本轮未重新逐函数核对两套源码，不宣称原版支持新网络架构；实施前核源码、依赖及授权。
待执行：STA/AP发现和切换、mDNS失败的BLE辅助发现/AP回退、DHCP地址变化、局域网隔离及无BLE电脑、无互联网、认证拒绝、配网安全、重连、无线共存、多端状态、队列及内存边界、TLS握手与证书错误、真实无线稳定性。先可重复构建/主机协议测试，再真机联调；不将SDK配置当实测。S1仍限已授权基础范围。下一项S5-02鉴权及多端权限单独评审。

## V0.2 用户修订
取消手动IP入口为明确产品要求；BLE获取地址与热点引导为自动回退的实现候选，具体流程和认证仍待S5-02及跨平台测试，不保证所有网络或电脑具备BLE。
