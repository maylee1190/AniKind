# 可编辑图表源代码

这些 ES Modules 是制作迭代图册时的原始布局代码，使用 `@oai/artifact-tool` / Artifact Session 的 Presentation API，不参与网站运行。

- `build-deck.mjs`：13 页迭代图册，导出 `buildOverview(p)`、`buildGroup(p, index)`、`buildInventory(p, index)`。
- `technical-board.mjs`：技术迭代总览图，导出 `build(p)`。
- `hardware-board.mjs`：硬件与终端关系图，导出 `build(p)`。
- `content.json`、`inventory.json`：迭代内容与源码登记。
- `screens/`：制图使用的公开演示界面截图与示例动物图片，不含用户私人资料。

在提供 Presentation API 的环境中，将有效的 `presentation` 对象传入相应函数即可生成原生可编辑页面。没有该运行环境时，可直接使用 [docs/iterations](../../docs/iterations/README.md) 中的 PNG、PDF 和 PPTX。

照片和设计资产的来源沿用 [ASSETS.md](../../docs/ASSETS.md) 与 [WILDLIFE_PHOTOS.md](../../docs/WILDLIFE_PHOTOS.md)。Before 中没有真实旧截图的部分属于已注明的技术流程示意。
