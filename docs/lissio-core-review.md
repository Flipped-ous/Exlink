# Lissio 核心代码阅读与 EXLINK 实现决策

本轮阅读的是串口传输、协议拼帧、原始字节路由、数值分发、缓冲/降采样、显示推送和录制队列等 23 个选定 Rust 文件。不是完整审计，也没有编译或运行 Lissio 后端。上游代码仅存于调研目录，未导入 EXLINK 运行。

## 固定版本

服务端：`Lissio-Server@96dc0e3516efb9350b44df7fb980e72187b9d97a`。其依赖固定为：

- `Lissio-Core@a93d1be9228df7ce87723a8926437558780f021e`
- `Lissio-Physical@23dc934e9d9ae1fc26eeb29f80d1f69bf3775cf8`
- `Lissio-Data@f79c3877efbac3389ce3f79cfe24f07cb5325950`

本地版本证据及文件清单见 `research/lissio/core/repositories.json`、`selected-files.json`。四个仓库目录接口均未截断；这不表示已逐一阅读全部源码。

## 可借鉴的实现，以及我们怎样使用

| 核心机制 | 阅读依据 | EXLINK 决策 |
| --- | --- | --- |
| 传输与协议分离 | Physical 的 `serial.rs`、`interfaces.rs`：串口独立读写任务、控制队列；字节流和 UDP 数据报接口不同 | 后续串口适配只提交字节和来源，不让每个视图各开一个连接。当前只接演示和文件 |
| 有状态增量解码 | Core 的 `ProtocolEngine::feed`、`justfloat.rs`：保留未完成帧，完整帧才分发 | 实现独立 `StreamDecoder`；键值行、CSV、JustFloat；支持跨包拼帧、32 通道和未完成帧上限 |
| 原始数据先保留，解析后多视图分发 | Server 的 `byte_router.rs`、`frame_dispatch.rs`：原始录制与解析/求值分开，相同协议配置可共用解析 | 一个 `SessionEngine` 同时提供日志和数值帧；波形组件不再单独生成示例曲线 |
| 连接变化和缺口是显式状态 | Server 的 `read_task.rs`：按连接 epoch、方向和数据报边界合批，缺口重置解析 | 新会话/更换协议重置残帧并递增 epoch。真实断连事件及采集缺口尚待传输适配 |
| 有界缓存与背压 | Server 的 `eval_queue.rs`、Data 的录制 writer 通道：数量、字节及队列界限，丢弃可观察 | 原始日志 5,000 条、数值帧 20,000 条，两者另有 8 MiB 估算权重预算。显示原始记录淘汰数；不是 JS 实际堆内存保证 |
| 原始数据和显示降采样分开 | Data 的 `data_buffer.rs`、`window/downsample.rs`：ring buffer、缺值 NaN、多通道极值 | 显示投影使用多通道 min/max，保留窄峰和缺通道边界；缺口可能超过软像素预算，不修改原始帧 |
| 显示按版本更新 | Server 的 `envelope_stream.rs`：数据版本未变时跳过，快照后做昂贵计算 | UI 订阅稳定快照；本版仍在 renderer 线程解析，未移植后台任务/GPU/二进制 IPC，不能声称获得其吞吐能力 |
| 录制不依赖图求值 | Data 的 `recording/hub/ingest.rs`、`writer/channel.rs`：有界写入、序号缺口、耐久故障区分 | 保留这个后续架构方向。本版导出只是当前保留日志，不是完整持续录制 |

部分固定版本源码链接：

- [字节路由](https://codeberg.org/lissio-industries/Lissio-Server/src/commit/96dc0e3516efb9350b44df7fb980e72187b9d97a/crates/desktop/pipeline/src/data_plane/byte_router.rs)
- [增量协议接口](https://codeberg.org/lissio-industries/Lissio-Core/src/commit/a93d1be9228df7ce87723a8926437558780f021e/crates/protocol/protocol/src/traits.rs)
- [波形缓存](https://codeberg.org/lissio-industries/Lissio-Data/src/commit/f79c3877efbac3389ce3f79cfe24f07cb5325950/crates/signal/waveform/src/data_buffer.rs)
- [显示降采样](https://codeberg.org/lissio-industries/Lissio-Data/src/commit/f79c3877efbac3389ce3f79cfe24f07cb5325950/crates/signal/waveform/src/window/downsample.rs)

## 不照搬的细节

阅读的 [FireWater 实现](https://codeberg.org/lissio-industries/Lissio-Core/src/commit/a93d1be9228df7ce87723a8926437558780f021e/crates/protocol/protocol_float/src/firewater.rs) 对逗号字段使用 `filter_map(parse.ok())`。例如 `1,bad,3` 会只剩两个值，容易让后面的值落到前一个通道。它还先对每个输入块做 UTF-8 校验；多字节字符被分包时可能整块未被接纳。

EXLINK 先按字节拼出完整行，再解码 UTF-8；任何坏字段、重名、空值或非有限值都拒收整帧，原始字节仍保留。JustFloat 超限后等待下一帧尾恢复，不把残余字节当新帧。名称:数值协议将普通文本日志视为非数值消息。

Lissio `run_control.rs` 的 Pause 主要约束设备写入，采集、缓存、录制可继续；Stop 是更强的管线门控。EXLINK 当前只有“暂停显示”：冻结日志/波形视图，演示接收仍继续。不能把它称为硬件暂停或完整录制。

## 当前实现与布局

- `src/core/session.ts`：独立编写的解析器、双缓冲、会话快照和显示降采样。
- `src/components/Waveform.tsx`：读取会话数值帧；时间窗、组选择、通道显隐同行排列；移除右侧属性栏。
- `src/App.tsx`：文字工具导航 + 单一标题/操作区；连接与协议按需浮层打开；自定义仍在设置里，不提供节点编辑器。
- 品牌采用用户认可的紫色折带 E。紫色集中在选中、焦点、主动作及品牌，数据区采用稳定中性色；玻璃材质集中在控制浮层。

导入文件的横轴使用接收记录时间，未推断设备采样率。相同时间戳仅在绘图投影取最后一帧，原始记录和数值缓存不删除。没有协议单位元数据的离线文件不擅自显示 RPM/A/V；演示源的已知字段有演示单位映射。

## 验证与下一层工作

本轮 14 项数据测试通过，覆盖跨包 UTF-8、多帧、CSV 坏字段、JustFloat 分包与超限同步、双上限缓存、会话更换、协议重解析、缺值间隙和多通道窄峰。严格 TypeScript 检查和生产构建通过。

桌面窗口结构已确认载入新版；截图工具返回前台浏览器而不是目标窗口，因此视觉验收及完整 UI 点击验证尚未完成。当前硬件操作仍未接入。

真实串口阶段应补上传输适配、独立后台解析/批处理、断连与缺口事件、可观察背压及持续录制。以上没有因为这次读取源码而自动完成。
