# S0-12｜模块通信与事件机制 V0.1（用户确认）
2026-11-26。延续双参考复审及 S0-09 V0.2。以下为内部接口设计，不锁定传输协议、数字错误码、队列最终容量或任务配置，不授权正式业务开发。

## 参考依据
方屏固定 SHA 259434f5f6addb91ea0c2b1fa0ffe756d9f4d628：
- include/internal_i2c_service.h：submit(kind,value,id)、takeResult、takeTouch，RequestCapacity=8、ResultCapacity=16、TouchCapacity=16。
- src/internal_i2c_service.cpp 60–89：outstanding_requests_ 信用计数，覆盖已接受且尚未取结果的请求；提交失败归还信用。91–101：generation 过滤过期触摸事件。295/308–313：结果及触摸队列发布，须核溢出/竞争处理。
- src/main.cpp 2026–2069、2343、2452–2469：连接/断开/MTU事件队列（容量8）；2588–2622 请求及结果；4524起 loop 消费事件。回调发送失败不能默默忽略关键断连状态。
- include/device_update.h：传输无关 UpdateReceiver、UpdateSink、session/offset/CRC/哈希和 begin/write/finish/activate/abort；include/ble_update_service.h：进度快照及业务回调不在 BLE 回调中执行。
- ExlinkPro 原版参考见 source-audit.md：全局标志位及 loop 业务调用为迁移起点；原版逐函数定位仍须实施时核实，不用其 flag 替代跨端命令和结果关联。
遵守源码授权；不直接上传第三方实现。

## 模块及数据
Command Dispatcher 统一识别来源、鉴权、参数校验和分发，不作为全局串行 I/O 工作任务。State Store 按服务保存权威状态，采用同步快照、有效性、时间戳及状态版本；Event Channel 传递结果和事件，轻量有界，不强制新增任务。Safety 具有独立紧急关闭通知和锁存，不依赖普通队列。内部 I2C 仍唯一事务所有者。
| 数据 | 方式 |
|---|---|
| Command | 有界命令队列、类型化参数 |
| Result | 有界结果队列，关联请求ID |
| State | 同步的最新状态快照 |
| Event | 队列/任务通知，安全故障独立锁存 |
| Stream | 独立环形缓冲/采样缓冲，明确流控和丢失统计 |

CommandHeader 候选 id/source/type/timestamp；类型化载荷如 SetVoltageCommand.target_mv。来源与会话身份由可信入口绑定，不信任客户端自报身份；同一请求的去重以会话/来源和ID为范围，重连与复位行为由协议阶段确定。单位 mV、µA、µW 等，负压数据用有符号类型；不直接以 C++ 内存结构作为网络格式。请求接受、寄存器写入、实际输出验证为不同状态；输出关闭时只确认设定值，不声称实际电压已达到目标。Safety 审核并控制危险输出，Power Service 执行受控配置，INA226 反馈经测量及安全策略判断后发布。

## 流控、并发与错误
参考方屏 I2C 请求8/结果16/触摸16、BLE事件8，先测量再扩容。接受命令前预留终态结果容量；所有成功、失败、取消路径归还信用，处理队列满、消费者断连、过期结果、重试、ID重复、超时；关键状态不能仅依赖易丢的事件，断连后重新同步快照。遥测可合并或降采样，控制请求拒绝返回 BUSY，紧急关闭独立。UI 不阻塞等待 I2C/Flash/网络，回调短小且不得直接改 LVGL。
多端允许读取；同功能修改由对应服务串行处理，设备是权威状态来源。授权端关闭输出优先；OTA期间拒绝普通控制；资源冲突返回原因，危险故障主动关断。按S0-13 V0.2，客户端断连本身不关正常输出；取消过期未执行请求，重连同步状态，不重放或恢复危险输出，真实故障仍关断。超时不等于未执行，先查询状态再决定重试；重复命令不可重复产生副作用。状态快照区分目标/实际/有效性；不把最后一次有效测量伪装成实时值。
| 内部错误名 | 用户中文文案 |
|---|---|
| OK | 操作成功 |
| BUSY | 设备繁忙，请稍后重试 |
| INVALID_PARAM | 参数设置错误 |
| RESOURCE_CONFLICT | 功能冲突 |
| TIMEOUT | 操作超时 |
| HARDWARE_ERROR | 硬件通信异常 |
| SAFETY_LOCKED | 安全保护已启动 |
| UNAUTHORIZED | 无操作权限 |
| NOT_SUPPORTED | 当前硬件不支持 |
| CANCELLED | 操作已取消 |
| DATA_STALE | 测量数据已失效 |
内部枚举非最终线上错误码；用户文案不泄漏凭据，具体细节可在设置→系统诊断查看。

## 工程位置与验收
候选 src/system/events/{command_dispatcher,event_channel}、src/system/state/state_store、lib/exlink_core/src/messages/{command_types,event_types,device_state,error_codes}；按需创建，避免过度封装。OTA 借鉴方屏 UpdateReceiver，统一写入所有权，签名及安全互锁沿用已批准设计，不把 CRC/哈希当作身份认证。
验证队列信用、并发请求、终态结果、断连/重连、重复ID、超时后状态查询、过期数据、波形流控、紧急关断通知、UI响应、Mock/真实HAL一致性。真实设备及协议测试未执行。

## 全中文界面（用户确认）
所有用户可见界面统一简体中文，包括设备 LVGL、手机 Companion、电脑 Studio、虚拟设备界面、设置/系统诊断、OTA、弹窗、错误及状态提示。USB、Wi-Fi、BLE、PWM、I²C、UART 等标准缩写及品牌名称可保留；内部代码标识符、协议字段、错误码仍用英文，界面映射中文文案。集中管理文案及中文字体，嵌入式优先验证字库裁剪、缺字及内存占用；首版不额外增加多语言切换。
系统诊断仅在设置内，后台保护及必要安全告警独立运行。验收检查所有用户可见文案、错误映射、字库缺字、溢出/截断；实际 UI 尚未实现。本次仅设计归档。
