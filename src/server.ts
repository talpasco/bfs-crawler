const http = require("http");
const ws = require("ws");
let url = require("url");
const loopback = require("loopback");
const boot = require("loopback-boot");
const app = (module.exports = loopback());
const session = require("express-session");
const redis = require("redis");
const RedisStore = require("connect-redis")(session);
let redisDB = {
  host: "localhost",
  port: 6379,
};
// instanciate an instance of express and hold the value in a constant called app
//require the body-parser library. will be used for parsing body requests
const bodyParser = require("body-parser");
//require the path library
const path = require("path");

// use the bodyparser as a middleware
app.use(bodyParser.json());
// set port for the app to listen on
app.set("port", process.env.PORT || 3001);
// set path to serve static files
app.use(loopback.static(path.resolve(__dirname, "../public")));
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

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;
});

//Session stickyness
app.middleware(
  "session:before",
  require("cookie-parser")(app.get("cookieSecret"))
);
const RedisClient = redis.createClient({
  host: redisDB.host,
  port: redisDB.port,
});
let sessionStore = new RedisStore({ client: RedisClient });
let sessionObj = session({
  store: sessionStore,
  secret: "K6Wd%8*8x75G",
  saveUninitialized: true,
  resave: true,
  cookie: {
    signed: true,
    maxAge: 61320000,
  },
});
app.middleware("session", sessionObj);
app.use(sessionObj);
const { crawlBFS } = require("./crawler.js");
// defined the base route and return with an HTML file called tempate.html
app.get("/", function (req, res) {
  res.sendFile("template.html", {
    root: path.join(__dirname, "view"),
  });
});

app.webStart = function (httpOnly) {
  let server = http.createServer(app);
  server.listen(app.get("port"), function () {
    console.log("Server listening on port " + app.get("port"));
    if (app.get("loopback-component-explorer")) {
      const explorerPath = app.get("loopback-component-explorer").mountPath;
      console.log("Browse your REST API at %s%s", explorerPath);
    }
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
