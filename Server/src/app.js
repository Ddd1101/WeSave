const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const assetsRouter = require("./routes/assets");
const errorHandler = require("./middleware/error");

const app = express();
const PORT = process.env.PORT || 8088;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));
app.use("/api/assets", assetsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Server] 家庭资产管理系统后端运行于 http://localhost:${PORT}`);
});
