# 旅行行程簿

一个把旅游计划 Markdown 解析为可视化时间表的静态网页应用。页面会优先加载同目录的 `trip.md`；文件不存在、无法读取或格式错误时，自动切换为本地文件上传模式。

## 功能模块

1. **默认计划加载**：启动时尝试读取 `docs/trip.md`，成功后直接显示时间表。
2. **本地文件兜底**：默认计划不可用时，可点击选择或拖入 `.md` 文件；内容只在当前浏览器中处理，不上传服务器。
3. **Markdown 数据层**：解析日期标题、时间段、行程名称、说明和标准地点元数据。
4. **可视化时间轴**：按文件中的日期切换，显示时间、详情与位置。
5. **完成状态**：每段行程均可勾选；进度按文件内容分别保存在浏览器 `localStorage`。
6. **进度概览**：显示已完成数量、百分比和环形进度。
7. **地图导航**：地点可选择高德地图、百度地图或 Apple 地图，手机端优先唤起相应 App。
8. **响应式界面**：适配手机与桌面，支持键盘操作、拖放和减少动画偏好。
9. **错误处理**：文件过大、扩展名错误、编码异常或格式无法识别时显示具体原因。

## 本地运行

启动一个本地网页服务：

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory docs
```

然后访问 `http://127.0.0.1:4173/`。

默认会加载 `docs/trip.md`。删除或改名该文件即可测试上传兜底模式。

## GitHub Pages

在仓库的 `Settings → Pages` 中选择：

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/docs`

保存后即可通过 GitHub Pages 分配的地址访问。更新默认行程时，只需替换 `docs/trip.md` 并推送。

## Markdown 核心格式

```markdown
## 10 月 3 日｜抵达与海滨漫步

### 15:00—17:00 海滨徒步
- 类型：徒步
- 地点：幸福门
- 地址：山东省威海市环翠区海滨北路48号
- 导航关键词：幸福门景区入口
```

完整规范和校验器位于 `../travel-plan-md-standard/`。

## 文件结构

```text
weihai-trip-app/
├─ .openai/hosting.json
├─ README.md
├─ tests/
└─ docs/
   ├─ .nojekyll
   ├─ index.html
   ├─ styles.css
   ├─ app.js
   └─ trip.md
```

