# sub-gen-worker

一个部署在 Cloudflare Workers 上的轻量级代理订阅生成器。它能将单个代理节点信息转换为与 Clash 和 Shadowrocket 客户端兼容的完整订阅配置文件，支持 API 传参和 Web 界面。


## 特性

-   **多模式使用**：支持通过 Web UI 手动配置，或通过 API 参数化调用。API 使用场景例如在Excel或多维表格等应用中通过公式拼接到本项目 API，一键订阅。
-   **一键导入**：通过 URL Scheme 直接唤起客户端并导入配置。
-   **动态配置**：基于单个节点信息生成包含代理组和基础规则的完整 YAML 文件。
-   **智能旗标**：自动识别节点名称中的地区关键词并添加对应的国家/地区旗帜。
-   **无服务器部署**：完全运行在 Cloudflare 的全球网络上，免费且无需独立服务器。



## 部署

1.  登录 Cloudflare 控制台，进入 **Workers & Pages**。
2.  **创建应用程序** > **创建 Worker**。
3.  命名 Worker（例如 `sub-gen`）并点击 **部署**。
4.  部署完成后，点击 **编辑代码**。
5.  将仓库中的 `index.js` 代码完整粘贴至编辑器。
6.  点击 **保存并部署**。

部署完成后，即可通过 `https://<worker-name>.<subdomain>.workers.dev` 访问。
可以添加自定义域名防止Worker被墙。

## 使用方式

本项目提供两种主要使用方式：Web UI 和 API 调用。

### 1. Web UI 模式

直接在浏览器中访问您部署的 Worker URL。

该界面提供了一个交互式表单，用于填写代理节点信息。填写完毕后，点击 “导入到 Clash” 或 “导入到 Shadowrocket” 按钮，即可自动生成配置并尝试唤起相应的客户端。

![Web UI Screenshot](https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index.jpg)


### 2. API 调用模式

该模式允许通过构造特定的 URL 来实现自动化和集成。访问此 URL 将直接触发配置生成和客户端导入流程。

![API UI Screenshot](https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index-api.jpg)


#### 端点 (Endpoint)

```
https://<Your-Worker-URL>/?<parameters>
https://sub-gen.example.workers.dev/?name=香港节点-01&server=1.2.3.4&port=1080&username=user&password=pass
```

#### 请求参数

| 参数       | 类型     | 描述                 | 示例            |
| :--------- | :------- | :------------------- | :-------------- |
| `name`     | `string` | **必需**, 节点名称     | `香港节点-01`   |
| `server`   | `string` | **必需**, 服务器地址   | `1.2.3.4`       |
| `port`     | `number` | **必需**, 端口         | `1080`          |
| `type`     | `string` | 协议类型 (`socks5`)  | `socks5`        |
| `username` | `string` | 用户名（可选）       | `user`          |
| `password` | `string` | 密码（可选）         | `pass`          |

#### 调用示例

构造一个包含所有必要参数的 URL：

```
https://sub-gen.flyrr.cc/?server=1.2.3.4&port=1080&username=user&password=pass&name=香港节点-01
```

直接在浏览器中访问此 URL，将自动填充表单并尝试为 Clash 客户端导入配置，适合用于快捷方式或脚本集成。

## 技术实现

-   **前端界面**：根路径 `/` 返回一个包含表单和客户端交互逻辑的 HTML 页面。
-   **后端 API**：路径 `/config` 接收 URL 查询参数，动态生成 YAML 格式的配置文件，供客户端订阅。
-   **URL Scheme**：
    -   Clash: `clash://install-config?url=<ENCODED_CONFIG_URL>`
    -   Shadowrocket: `shadowrocket://add/<ENCODED_CONFIG_URL>`