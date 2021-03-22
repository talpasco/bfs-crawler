const { crawlBFS } = require("./crawler.js");
const http = require("http");
const ws = require("ws");
let url = require("url");

const queryIndexName = "cities";

//require Express
const express = require("express");
// instanciate an instance of express and hold the value in a constant called app
const app = express();
//require the body-parser library. will be used for parsing body requests
const bodyParser = require("body-parser");
//require the path library
const path = require("path");

// use the bodyparser as a middleware
app.use(bodyParser.json());
// set port for the app to listen on
app.set("port", process.env.PORT || 3001);
// set path to serve static files
app.use(express.static(path.join(__dirname, "public")));
// enable CORS
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// defined the base route and return with an HTML file called tempate.html
app.get("/", function (req, res) {
  res.sendFile("template.html", {
    root: path.join(__dirname, "view"),
  });
});

app.get("/search", function (req, res) {
  let links = crawlBFS(req.query["q"], 5, 15);
});

app.webStart = function (httpOnly) {
  let server = http.createServer(app);
  server.listen(app.get("port"), function () {
    console.log("Express server listening on port " + app.get("port"));
  });
  return server;
};

const webServer = new ws.Server({
  server: app.webStart(),
  perMessageDeflate: false,
});

webServer.on("connection", function (socket, req) {
  const urlParams = url.parse(req.url, true).query;
  let userID = urlParams.uid;
  console.log({ userID: userID, msg: "Got webServer Connection" });

  socket.on("message", function (message) {
    let msg = JSON.parse(message);
    crawlBFS(socket, msg.query, msg.depth, msg.pages);
  });

  socket.on("error", function (error) {
    console.error({ userID: userID, error: error });
  });

  socket.on("open", function () {
    console.info({ userID: userID, msg: "webServer Socket Connection Opened" });
  });

  socket.on("close", function (code, message) {
    //delete socket;
    console.info({
      userID: userID,
      msg: "webServer Socket Connection Closed" + message,
      code: code,
    });
  });
});
