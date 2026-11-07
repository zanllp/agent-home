# Runner、观看端与性能日志

默认 `node start.mjs` 在本机 HTTP 服务就绪后，启动一个有独立临时配置目录的 headless Chrome/Chromium。无需登录，不使用个人浏览器配置，不开放远程调试端口。需要 Node 22.12+ 和同一环境中可执行的 Chrome/Chromium（含 WebGL2）。不随包下载浏览器、不绕过 Linux sandbox。找不到浏览器会明确报错。

```sh
# WSL 内，有 chromium 时通常不必指定；手动指定必须是可执行文件的绝对路径
HOUSE_CHROME=/usr/bin/chromium node start.mjs
# Windows 浏览器打开 http://localhost:19130/ （需要 WSL localhost 转发可用）
# 同机使用也一样，第二个观看页面不会新建 Runner。
curl -s http://localhost:19130/api/runtime
tail -f house3d/data/logs/performance.jsonl
```

`runner:true, online:true` 表示服务最近收到了 Runner 的状态，不代表某条指令已完成。照旧用 observe_home 的 fresh、body_job_id、job.phase 和身体姿态判断。关闭观看页不影响导航、姿态保持、Agent 截图。截图由 Runner 按家中相机预设或角色视角生成，不拷贝某位观众临时拖动过的镜头。不同观看页可以独立转镜头，也可以请求共享动作、暂停和快慢切换。

Runner 载入一次场景和模型（有内存和初始化开销），平时只推进身体与交互，不持续向 GPU 画全屋；截图时才应用视觉姿态并绘制。观看页通过本机事件流接收姿态，插值展示，不执行导航、不提交动作回执、不争截图。远端显示使用本地 GPU，观看者越多总绘制成本仍会增加。无公网监听、鉴权服务或 DSH 改动。

`node start.mjs --no-runner` 或 `HOUSE_RUNNER=0` 关闭后台浏览器：服务端仍只需 Node，此模式由一个可见页面执行身体与截图。不要对同一存档再启动第二个服务。正常 Ctrl+C 会关闭本服务创建的浏览器并清理临时配置。Runner 异常退出时不会让旁观页悄悄接管或自动重放命令；查日志，正常重启服务。

## 怎样看日志

默认在数据库旁的 `logs/performance.jsonl`，可用 `HOUSE_LOG_DIR` 指定目录。单文件约 1 MiB，保留一代 .1；只写本地，不逐帧写盘。每 15 秒汇总：

- `node`：Node 进程 cpu_pct（一核满载为 100）、rss_mb、heap_mb、事件循环采样 p95。不是 Chromium 整个进程树的内存或系统 GPU 使用率。
- `browser`：role 区分 runner、viewer、local，session 区分观看页。window_ms 是实际采样窗；frames、calls、triangles、shadow_frames 是常规显示绘制，截图单列 screenshots。active_ticks 是身体更新次数。frame_p95_ms 是循环间隔，不是 GPU 耗时。
- submit_ms 是采样窗内 CPU 绘制提交耗时总和。支持计时扩展时约每秒异步抽一帧，gpu_sample_ms / gpu_samples 是已取得的 GPU 样本平均毫秒，不是显卡占用率。没有有效样本时不估算。
- `action_accepted` / `action_progress` 以 job 关联，since_accept_ms 包含等待消费和实际走路/进入姿态的时间。runner_start、runner_connected、runner_error、runner_exit 用于定位启动或连接问题。浏览器事件流重连也计数。

对比时固定窗口尺寸、机位、家具和动作，分别观察走路、画画、休息和截图；不要把休息窗口当成走路数据。

动态画面保留原模型与分辨率，对允许列表中的静态家具按相同材质、顶点属性和投影标志合并绘制。活动中的角色仍逐帧更新，方向光阴影刷新间隔约 65 ms；机位切换、布置失效和截图会刷新。不同浏览器之间传位置、姿态和动画相位，不传桌面视频。
