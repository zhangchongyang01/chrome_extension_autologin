# 图标文件说明

Chrome 插件需要 PNG 格式的图标文件（16x16, 48x48, 128x128 像素）。

## 生成图标的方法

### 方法1：使用在线工具
1. 访问 https://convertio.co/svg-png/ 或类似工具
2. 上传 `icon.svg` 文件
3. 分别生成 16x16、48x48、128x128 三种尺寸
4. 保存为 `icon16.png`、`icon48.png`、`icon128.png`

### 方法2：使用图像处理软件
1. 使用 Photoshop、GIMP 等软件打开 `icon.svg`
2. 分别导出为 16x16、48x48、128x128 像素的 PNG 文件
3. 保存到 `icons` 目录

### 方法3：使用命令行工具（需要 ImageMagick）
```bash
# 安装 ImageMagick 后执行
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### 临时方案
如果暂时没有图标文件，可以：
1. 从网上下载任意 16x16、48x48、128x128 的 PNG 图标
2. 重命名为 `icon16.png`、`icon48.png`、`icon128.png`
3. 放入 `icons` 目录

插件功能不受图标影响，即使没有图标文件也能正常工作（只是显示默认图标）。

