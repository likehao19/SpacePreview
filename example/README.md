# SpacePreview 演示文件

这里放的是用于预览演示的样本，不是“所有后缀都能打开”的兼容性承诺。

## 推荐先看

- 三维与图纸/pr2-real.stl：真实机器人零件。
- 三维与图纸/Cerberus.obj：真实 OBJ 网格，只显示几何，不加载外部材质。
- 三维与图纸/assembly.stp：真实 STEP 工程装配体。
- 三维与图纸/AC1015.dwg、AC1021.dwg、AC1032.dwg：AutoCAD 2000、2007、2018 测试图纸。在最新桌面开发版中打开，支持二维图元、图层、平移和缩放。
- 三维与图纸/large-200k.stl：生成的 20 万三角面压力样本，约 10 MB，属于性能测试数据。
- 三维与图纸/sample.dxf：咖啡门店平面图。
- 音视频/sample.webm：带中文讲解的门店经营演示视频。

## 打不开的原样本为什么有问题

原生成脚本把“没有真实文件”的文字说明写成了二进制格式后缀；也把 ZIP 改名为 RAR、7Z、ISO。STEP 只有孤立坐标点，DXF 只有当前二维预览器不支持的三维面；另有 SVGZ 实际未压缩、部分 3MF / EPUB / LZMA 结构不完整。

已经替换有真实来源的样本；57 个暂缺真实替代文件的无效原件保存在 ../test-results/example-originals/removed，原始内容另有备份，未丢弃。待补格式见 [待补充格式](待补充格式.md)。缺少样本不等于软件一定不支持该格式。

应用包、扩展包、安装包后缀中的一些文件仅是目录或复合流结构演示，用来查看内部文件；它们不是可安装、可执行或经过签名的软件包。不要用这些结构样本测试安装功能。Office 模板后缀也主要用于测试文档内容预览。

## 运行条件

- DWG 需要含新引擎的桌面版，网页调试模式不支持，已安装的旧正式版也没有此改动。
- 压缩包需要在左侧展开目录、选择内部文件；显示目录并不代表预览失败。
- DOC / DOT 为文字速览；图纸、自定义图元、外部参照、Office 排版等并非原软件的完整还原。
- 旧 PowerPoint 的页面转换依赖 Windows 本机已激活的 Microsoft PowerPoint。
- 音视频支持取决于内部编码和系统 WebView 解码器。

## 来源与复验

真实模型来自 Three.js（pr2_head_pan、Cerberus）、occt-import-js（CAX-IF 装配体）；DWG 来自 DomCR/ACadSharp 的 samples/sample_AC1015.dwg、sample_AC1021.dwg、sample_AC1032.dwg。新增真实文件仅作为本地测试材料，转发或发布前应核对各上游样本许可。其余图像、文档、压缩包的替代样本来自项目现有 test-results/fixtures 回归样本。

生成脚本不再制造假后缀占位文件。可用以下命令检查与整理：

```powershell
node scripts/download-cad-model-fixtures.mjs
node scripts/repair-example-files.mjs
node scripts/audit-examples.mjs
```

审计输出：../test-results/example-audit.json；问题原件记录：../test-results/example-originals/repair-report.json。
