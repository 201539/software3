import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#2c5282",
          borderRadius: 6,
          fontFamily:
            '"Segoe UI", system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          colorBgLayout: "#eceef1",
        },
        components: {
          Layout: {
            headerBg: "#f7f8fa",
            bodyBg: "#eceef1",
          },
          Menu: {
            itemHeight: 40,
            iconSize: 16,
            collapsedIconSize: 16,
          },
          Tabs: {
            horizontalMargin: "0 0 12px 0",
            cardGutter: 4,
            titleFontSize: 13,
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
