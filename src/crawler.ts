"use strict";

const crawler = (function () {
  const cheerio = require("cheerio");
  const { URL } = require("url");
  const puppeteer = require("puppeteer");
  const stringify = require("fast-safe-stringify");
  const app = require("./server.js");

  class CreateLink {
    url: string;
    title: string;
    depth: number;
    parent: string;
    toCrawl: boolean;
    children: [];
    constructor(linkURL, title, depth, parent, toCrawl) {
      this.url = linkURL.replace(/\/+$/g, "");
      this.title = title;
      this.depth = depth;
      this.parent = parent;
      this.children = [];
      this.toCrawl = toCrawl;
    }
  }

  async function crawlBFS(socket, startURL, maxDepth = 5, maxPages = 15) {
    let session = {
      visitedList: {},
      rootNode: {},
      currentNode: {},
      linksQueue: [],
      printQueue: [],
      crawledCount: 0,
      previousDepth: 0,
      maxCrawlingDepth: 5,
      maxCrawlingPages: 15,
      mainDomain: null,
      mainParsedUrl: null,
      browser: null,
      ws: socket,
    };
    try {
      session.mainParsedUrl = new URL(startURL);
    } catch (e) {
      console.log("URL is not valid", e);
      return;
    }

    session.mainDomain = session.mainParsedUrl.hostname;

    session.maxCrawlingDepth = maxDepth;
    session.maxCrawlingPages = maxPages;
    let startLinkObj = new CreateLink(startURL, startURL, 0, null, true);
    session.rootNode = session.currentNode = startLinkObj;
    addToLinkQueue(session.currentNode, session.linksQueue, session);
    await findLinks(session, session.currentNode);
  }

  async function loadContent(url, session) {
    session.browser =
      session.browser ||
      (await puppeteer.launch({
        args: ["--unlimited-storage", "--full-memory-crash-report"],
      }));
    const [page] = await session.browser.pages();
    await page.goto(url);
    return await page.content();
  }

  //Get the HTML raw text and fetch the links and titles.
  async function findLinks(session, linkObj) {
    let response;
    try {
      response = await loadContent(linkObj.url, session);
      let $ = cheerio.load(response);
      ++session.crawledCount;
      linkObj.title = $("html").find("title").text();
      let links = $("body")
        .find("a")
        .filter(function (i, x) {
          return $(this).attr("href") != null;
        })
        .map(function (item, index) {
          let curUrl = $(this).attr("href");
          return !curUrl.includes("http")
            ? `${linkObj.url.replace(/\/+$/g, "")}/${curUrl.replace(
                /(^\/+|\/+$)/gm,
                ""
              )}`
            : curUrl;
        });
      if (links.length > 0) {
        links
          .filter((item, index) => links[index] !== item)
          .map(function (i, reqLink) {
            if (reqLink && reqLink != linkObj.url) {
              let newLinkObj = new CreateLink(
                reqLink,
                linkObj.title,
                linkObj.depth + 1,
                linkObj,
                reqLink.indexOf(session.mainDomain) > -1
              );
              addToLinkQueue(newLinkObj, session.linksQueue, session);
            }
          });
      } else {
        console.log("No more links found");
        closeSession(session);
      }
      let nextLinkObj = getNextInQueue(session);
      if (
        nextLinkObj &&
        nextLinkObj.depth <= session.maxCrawlingDepth &&
        session.crawledCount <= session.maxCrawlingPages
      ) {
        //next url
        await findLinks(session, nextLinkObj);
      } else {
        console.log("Session is closed...");
        closeSession(session);
        setRootNode(session);
      }
    } catch (err) {
      console.log("Something Went Wrong...", err);
      closeSession(session);
    }
  }

  function closeSession(session) {
    let crawlRes = JSON.stringify({
      crawl_res: true,
    });
    session.ws.send(crawlRes);
    session.browser.close();
    session.browser = null;
  }

  //Set the index of RootNode to the parent node
  function setRootNode(session) {
    while (session.currentNode.parent != null) {
      session.currentNode = session.currentNode.parent;
    }
    session.rootNode = session.currentNode;
  }

  function addToLinkQueue(linkobj, linksQueue, session) {
    if (!existInList(session, linkobj)) {
      let resObj = Object.assign({}, linkobj);
      if (linkobj.parent != null) {
        linkobj.parent.children.push(linkobj);
        resObj = linkobj.parent;
      }
      linksQueue.push(linkobj);
      addToVisited(session, linkobj);
      propegateMsg(
        resObj,
        session.mainParsedUrl.origin,
        session.printQueue,
        session.ws
      );
    }
  }

  function propegateMsg(resObj, mainDomain, printQueue, ws) {
    let msgObj = {
      url: resObj.url,
      title: resObj.title,
      depth: resObj.depth,
      children: resObj.children.map(({ title, url, depth, children }) => ({
        title,
        url,
        depth,
        children,
      })),
    };
    let msgSTR = stringify(msgObj);
    printQueue.push(msgSTR);
    app.models.crawl_history.set(mainDomain, printQueue);
    ws.send(msgSTR);
  }

  function getNextInQueue(session) {
    let nextLink = session.linksQueue.shift();
    while (nextLink && !nextLink.toCrawl) {
      nextLink = session.linksQueue.shift();
    }

    if (nextLink && nextLink.depth > session.previousDepth) {
      session.previousDepth = nextLink.depth;
      let crawlDepth = JSON.stringify({
        crawling_depth: session.previousDepth,
      });
      session.ws.send(crawlDepth);
    }
    return nextLink;
  }

  //Mark the visited pages list
  function addToVisited(session, linkObj) {
    session.visitedList[linkObj.url] = linkObj;
  }

  //Page is visited.
  function existInList(session, linkObj) {
    return session.visitedList[linkObj.url] == null ? false : true;
  }
  return {
    crawlBFS: crawlBFS,
  };
})();

module.exports = crawler;
