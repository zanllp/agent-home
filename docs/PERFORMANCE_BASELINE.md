# 自动性能验收

修改渲染源码后先运行 `npm run build`，然后用 `npm run test:perf`。测试要求 Node 22.12+ 和已安装、能运行 WebGL2 的 Chromium；可通过 HOUSE_CHROME 指定绝对路径。它在临时目录和独立回环端口启动真实服务、Runner 及固定窗口的观看浏览器，不使用当前存档，不需要人手动点 UI。不要与其他重 GPU 任务同时跑。

固定 8×6.5 家庭预设和 home 机位、白天晴天（不联网），采集完整 15 秒窗口而不是截图瞬间：静止＋电视、实际走到儿童椅并进入画画、保持暂停。记录 Renderer 的帧数、draw calls、三角形、阴影、p95 和支持时的异步 GPU 样本。必须观察到匹配 job 的新鲜画画姿态。空白画布、缺样本或缺执行器不能通过。

门槛覆盖：画画每帧最多 2050 次绘制、150 万三角形，阴影更新比例不超过 0.67；空闲屏幕更新不超过 15 fps；稳定暂停不连续重绘；Runner 常规显示帧为零。非零退出码可作为发布检查。通用门槛控制**工作量**，不能承诺某款 GPU 的占用率。

报告写入 `artifacts/perf-baseline.json`。要防本机耗时退化，先另存一份已验收报告，再执行 `npm run test:perf -- --compare /absolute/path/prior-report.json`。同机器、同场景、同画布尺寸比较 CPU 提交/帧、p95 帧间隔以及有足够样本的 GPU 耗时，保留噪声余量。对照文件不是跑失败后自动更新的金线。WSL 软件渲染的数据不要和 Windows 3070 Ti 的硬件加速数据混用。

连通户型使用 `HOUSE_PERF_SCENE=connected npm run test:perf`，对九十余件家具运行同样的静止、画画、暂停、Runner 验收，工作量门槛不放宽。报告单独写入 `artifacts/perf-connected.json`。不同户型不能互相作为耗时对照；发布两种户型时请分别运行。

`HOUSE_TEST_APARTMENT=1 node --test tests/connected-runner.test.mjs` 单独验收跨房间长路线：没有前台观看页时，从儿童床边经电视走到阳台，每段都等相同任务的身体停止并核对距离，最后取第一视角 PNG。不要与计时基线同时跑。

仓库保留了本次 Mac 的两份实际样本：`docs/perf-family-reference.json` 和 `docs/perf-connected-reference.json`。连通版的两个画画窗口分别约 1543、1542 次绘制/帧，约 138 万三角形/帧；Runner 两个窗口均未提交显示帧。不同设备先验工作量门槛，耗时请用自己的基线。
