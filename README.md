`Illustrator_Export_TIFF.jsx` 是一款 Adobe Illustrator 批量导出脚本。运行后，选择源文件夹、输出位置、分辨率和压缩选项，即可将该文件夹中的 `.ai` 文件批量导出为 `.tif`，无需提前逐个打开文件。

脚本默认以 300 ppi 导出，支持自定义分辨率和可选的 LZW 无损压缩。多画板文件会按画板分别导出并自动编号，遇到同名文件会追加序号，避免覆盖。界面支持简体中文和英文，启动时根据 Illustrator 的语言自动选择，也可以在窗口中手动切换。

`Illustrator_Export_TIFF.jsx` is a batch export script for Adobe Illustrator. Run the script, choose a source folder, output location, resolution, and compression setting, and export the `.ai` files in that folder to `.tif` without opening each file manually.

The script exports at 300 ppi by default and supports custom resolutions and optional lossless LZW compression. Each artboard is exported as a separate numbered TIFF, and existing files are preserved by adding a suffix when names conflict. The interface supports English and Simplified Chinese. It picks a language based on Illustrator’s locale at startup and lets you switch languages in the export window.
