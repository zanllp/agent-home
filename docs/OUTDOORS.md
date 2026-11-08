# 窗外的北京朝阳

`node agent.mjs get_outdoors`（HTTP：`GET /api/outdoors`） 返回北京市朝阳区代表位置（39.92°N, 116.44°E）的天气、资料时间和北京时间天光。服务端固定访问 [Open-Meteo Forecast API](https://open-meteo.com/en/docs)，是模型估计的当前天气，不是自家窗前的观测站。只发送固定区域坐标和气象字段，不发送存档、定位或身份数据。不需要密钥、Python、DSH，也不读取家里的 weather.py。免费公共接口面向非商业使用；商业部署需自行核对服务条款。

天光按北京时间分为清晨（05–09）、白天（09–17）、傍晚（17–19）和夜间，其余地区的系统时区不影响分档。窗外居民楼和窗边日光跟随天光，室内的灯光预设仍可独立使用。天气根据 WMO 码分雨、雪、雾、云、晴；无降水且能见度低于 5 km、湿度低于 80% 时使用霾的视觉表现，不将它作为实测 AQI。下雨时阳台地砖变湿，雨丝/雪花使用单个粒子或线段对象。

服务器 15 分钟内共用一次天气请求，失败后至少 5 分钟再试。90 分钟以内的旧资料标 stale；没有有效资料时返回 unknown，不冒充晴天。观看页和 Runner 分别按分钟读取同一结果，不阻塞动作和心跳。

可分别设置环境变量，重启此实例生效：
- `HOUSE_DAYLIGHT=auto|morning|day|dusk|night`，默认 auto。
- `HOUSE_WEATHER=auto|off|clear|cloudy|rain|snow|haze|fog`，默认 auto。off 不访问天气服务；指定天气是演示预设，不标成实时天气。
