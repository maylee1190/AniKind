# 设计资源使用记录

主基线：[Figma ui / 289:204](https://www.figma.com/design/UocyNNHftoeYl1Q6DxGmez/ui?node-id=289-204)。提取日 2026-09-16。未修改 Figma 原文件。

| 本地资源 | Figma 原资源标识 | 用途 |
| --- | --- | --- |
| woody.png | 1be32.png | 示例宠物抠图 |
| journey-mountain.png | eb2af.png | 山间旅行设计图 |
| journey-city.png | 5da35.png | 小城旅行设计图 |
| journey-meadow.png | 4be2e.png | 草地旅行设计图 |
| home.svg | 1d2a6.svg | 首页导航图标 |
| paw.svg | f2a94.svg | 爪印导航 / 品牌标记 |
| pin.svg | ba4b3.svg | 探索导航图标 |

以上保存 Figma 返回的原始文件字节，页面通过真实文本与控件重建，未把截图当界面。示例图片不等于用户真实记忆，生成模拟也明确标为模板演示。源资产没有完整授权台账，正式分发前仍需确认素材权利。

`world.geojson` 复制自工作区既有 `ne_110m_admin_0_countries.geojson`，用于 1:110m 国家线条；新增 `world-land-50m.geojson` 使用 Natural Earth 5.1.2 的 1:50m 陆地几何。地球采用 d3-geo 3.1.1 正射投影与球面裁切，点阵从陆地几何采样。Natural Earth 为公共领域数据，比例尺仍限制海岸线细节；这不是物种完整分布图，也不承担官方行政边界声明。

`logo.svg` 复制自工作区 `anikind-pet-logo.svg`，保留为已有品牌资产。主界面目前使用 Figma 爪印搭配文本品牌。

新地球的 PNG/SVG 均下载自 [Figma 濒危动物地球](https://www.figma.com/design/c19dGrM1HqpIPqOMB9x4tt/Untitled?node-id=0-1)，原始导出 URL、节点与本地文件记录在 `figma-globe-assets.json`。底图、图标与脚本全部从本站加载，不依赖远程 Figma 资源有效期。未下载 WWF 照片。

`public/vendor` 保存 d3-array 3.2.4、d3-geo 3.1.1 及各自 LICENSE。来源与映射细节见 [地球实现记录](GLOBE_IMPLEMENTATION.md)。

`public/assets/puzzle` 保存 Figma `UocyNNHftoeYl1Q6DxGmez` 的 289:428 / 289:554 节点原始 PNG / SVG，清单见 `figma-puzzle-assets.json`。当前沿用原始 SVG 拼块轮廓作为 CSS 遮罩、知识卡布局及配色。按用户 2026-09-25 要求，拼图、参考图、收藏封面和知识卡图片全部改为真实照片，未改动地球图标。

`public/assets/wildlife-photos` 包含 31 张当前地球动物实拍 JPEG 及 1 张已取消关卡的历史三角龙骨架照片，元数据见 `server/wildlife-photos.json`，逐图许可与来源见 [WILDLIFE_PHOTOS.md](WILDLIFE_PHOTOS.md)。当前拼图仅使用地球上的动物照片。照片来自 Wikimedia Commons 摄影者及昆士兰政府，保留摄影署名、原始来源和许可链接；未使用生成图片、卡通头像或相似物种替代。页面仅按比例缩放和拼块遮罩展示，摄影作品继续适用各自许可（包括 CC BY-SA 的相同方式共享要求）。
