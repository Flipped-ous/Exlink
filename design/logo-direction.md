# 当前 EXLINK 标志

采用用户最新上传的品牌图 `design/exlink-brand-reference-v3.png`：深靛圆角底、柔和紫色折带 E，不使用之前的发光轮廓版本。

原始参考图与历史候选仅在本地保留，GitHub 提交只包含当前应用使用的 PNG 资产和提示词记录。

应用图片：`public/brand/exlink-ribbon-dark-v3.png`，用于导航、关于页、favicon 和 Electron 窗口图标。

通过内置 imagegen 按用户品牌图的左上图标整理为独立 PNG，保留透明圆角外沿。它是基于参考图的重建资产，不是像素级裁切。完整提示见 `design/logo-v3-prompt.txt`，同一提示已作为 PNG 文本元数据嵌入。

此前候选放在 `design/archive/`，不再由应用加载。品牌图中的示例版本号不作为应用版本号。
