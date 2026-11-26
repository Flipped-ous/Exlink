# S1-03｜HAL 硬件抽象层详细设计 V0.1（用户确认）
2026-11-26。仅详细设计归档；目标实施分支嵌入式固件。未授权正式实施、真实硬件驱动或烧录。S0-06A收到Codex摘要，最小Arduino及LVGL工程据报告构建通过，完整审查证据未取得，依赖未冻结；S0-06其余验证、网表和实物仍待闭环。

## 目标及职责
上层应用通过业务服务访问统一硬件接口；Real HAL调用BSP与具体芯片驱动，Mock HAL使用可重复虚拟状态和故障模型；同一套可移植业务逻辑复用，不为两种环境分别重写业务。沿用S0-08、S0-10、S0-12、S0-13、S0-19及S1-01/02。HAL只承担硬件操作、反馈及错误传播，不重复实现Safety、ResourceManager、业务状态机或底层驱动。UI及远程客户端不可直接访问HAL。RP2040/CH549独立维护，不虚构ESP32内部数据通路。

## 接口分组（逻辑职责，非强制类或文件数量）
| 模块 | 职责 |
|---|---|
| Power HAL | 电源配置、控制及回读 |
| Measurement HAL | 电压、电流、外部ADC |
| Signal HAL | PWM、频率计、示波器 |
| Display HAL | 屏幕刷新、亮度、休眠 |
| Input HAL | 触摸、按键 |
| Bus HAL | I2C、UART等 |
| Storage HAL | 配置、Flash存储 |
| Platform HAL | 时钟、必要平台差异 |
只抽象真实需要跨环境复用的接口，不封装所有Arduino API，不为每个方法新建任务或类。高速采集采用独立有界缓冲，不逐采样调用虚接口；显示与输入保持LVGL单一所有者及生命周期，内部I2C由唯一事务所有者协调。具体接口签名、同步/异步执行语义及性能待实现验证。

## Power HAL候选示意
```cpp
class IPowerHal {
public:
    virtual ~IPowerHal() = default;
    virtual HalResult init() = 0;
    virtual HalResult setVoltageMv(int32_t voltage_mv) = 0;
    virtual HalResult readSetpointMv(int32_t& voltage_mv) = 0;
    virtual HalResult setOutput(bool enable) = 0;
};
```
示例非正式API，HalResult类型及执行模型待细化。Real参考MP28167-A及经核实输出控制链；Mock维护独立虚拟状态。setOutput仅供Safety授权内部路径，真实使能必须满足已批准安全条件；紧急关闭独立于普通队列/总线。寄存器配置成功、设定值回读及实际物理测量是不同结果；未知物理关断不得假称成功。普通I2C操作不得阻塞UI或安全路径。超时不代表未执行，先核真实状态再决定是否重试；不盲重试危险写入。不锁定未知GPIO、校准及保护阈值。

## 错误与数据
沿用S0-12的统一错误语义（OK、TIMEOUT、BUSY、HARDWARE_ERROR、INVALID_PARAM、NOT_SUPPORTED、DATA_STALE等；资源、安全、权限错误仍按已确认服务定义），保留必要底层错误原因用于诊断。非简单bool吞掉故障。测量数值、有效性、采样时间分开，负压等使用有符号单位，错误/过期不伪装为零或实时值。内部错误非最终线上编码。

## Mock及环境隔离
src/hal/下按需建立power_hal.h、measurement_hal.h、signal_hal.h等接口及real/、mock/实现；通过构建源选择和启动装配注入实现，不在每个业务函数反复判断模拟模式；native隔离Arduino/FreeRTOS/LVGL及真实I/O，PC固件级模拟复用可移植逻辑与实际LVGL页面；协议模拟器共享协议及测试向量，不强制跨语言绑定。模拟身份明显，故障控制接口仅存在模拟环境，不进入生产协议。注入时钟/固定种子，模拟正常负载、I2C NACK/超时、短路、过压及测量失效等；默认关闭，故障关断与人工解除后保持OFF，禁止自动恢复。会话中的理想电阻负载交互仅说明原理，非已实现模拟器或真实额定能力/保护证据。

## 双参考证据及适配
方屏固定SHA 259434f5f6addb91ea0c2b1fa0ffe756d9f4d628：include/internal_i2c_service.h 53–67单一Wire所有者及有界异步请求结果，77–84受控暂停/恢复；src/scope_capture.cpp 156–210 start/stop/owned/quiesce/resume、预占ADC1及release_failed；include/device_update.h 8–15、32–55传输无关receiver及sink接口，finish与activate分开。保留合理粒度与接口机制，不直接照搬旧MCP4017、额外传感器或自动恢复危险输出。
ExlinkPro原作者2026-06-29资料包software/Exlink/src/main.cpp 125–224 MP28167寄存器及步进、500和803旧INA换算/初始化、742–747启动顺序，依据此前实际源码审计，本轮未重新逐函数检查。旧校准不可用于新20mΩ目标，真实分流参数待核；新TLA2528及安全逻辑按新硬件适配。实施前再次核实来源、差异和逐项许可；不得将未经授权源码/镜像提交公开仓库。

## 验收条件（未执行）
- Real/Mock接口及错误语义一致，构建隔离，无模拟误操作真实危险输出；未核实接口不进入真实驱动。
- 注入时钟、故障及可重复测试，覆盖超时、失效数据、关断、恢复、资源释放失败；安全路径独立。
- 高速采集有界缓冲及生命周期，单一I2C所有者，UI不阻塞；native可移植逻辑实际单测。
- 记录依赖、命令、结果、未执行项和风险；实际硬件、时序、精度、电气安全仍须样机验证，模拟测试不能替代。
下一项S1-04日志与系统诊断详细设计待单独确认。
