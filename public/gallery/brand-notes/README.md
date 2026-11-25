品牌号笔记图片放这里（png/jpg/webp 均可）。

命名建议：01-xxx.png、02-xxx.png

加图步骤：
1. 把图片复制进本目录
2. 打开 src/components/Gallery.astro，在 brandNotes 数组里追加一条：
   { title: "笔记标题", category: "品牌号笔记", image: "/gallery/brand-notes/01-xxx.png" }
3. 保存即可，页面自动出现卡片
