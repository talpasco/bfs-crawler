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
    children: [];
    constructor(linkURL, title, depth, parent) {
      this.url = linkURL.replace(/\/+$/g, "");
      this.title = title;
      this.depth = depth;
      this.parent = parent;
      this.children = [];
    }
  }

  async function crawlBFS(socket, startURL, maxDepth = 5, maxPages = 15) {
    let session = {
      visitedList: {},
      rootNode: {},
      currentNode: {},
      linksQueue: [],
      crawledCount: 0,
      previousDepth: 0,
      maxCrawlingDepth: 5,
      maxCrawlingPages: 15,
      mainDomain: null,
      mainParsedUrl: null,
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
    let startLinkObj = new CreateLink(startURL, startURL, 0, null);
    session.rootNode = session.currentNode = startLinkObj;
    addToLinkQueue(session.currentNode, session.linksQueue, session);
    await findLinks(session, session.currentNode);
  }

  async function loadContent(url) {
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        "--disable-features=CrossSiteDocumentBlockingAlways,CrossSiteDocumentBlockingIfIsolating",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 800 });
    await page.setBypassCSP(true);

    await page.goto(url);
    let html = await page.content();
    await browser.close();
    return html;
  }

  //Get the HTML raw text and fetch the links and titles.
  async function findLinks(session, linkObj) {
    let response;
    try {
      response = await loadContent(linkObj.url);
      let $ = cheerio.load(response);
      ++session.crawledCount;
      let title = $("html").find("title").text();
      let links = $("body")
        .find("a")
        .filter(function (i, x) {
          return $(this).attr("href") != null;
        })
        .map(function (item, index) {
          let curUrl = $(this).attr("href");
          if (curUrl.includes(linkObj.url)) return curUrl;
          return !curUrl.includes("http")
            ? `${linkObj.url.replace(/\/+$/g, "")}/${curUrl}`
            : null;
        });
      if (links.length > 0) {
        links
          .filter((item, index) => links[index] !== item)
          .map(function (i, x) {
            let reqLink = checkDomain(x, session);
            if (reqLink && reqLink != linkObj.url) {
              let newLinkObj = new CreateLink(
                reqLink,
                title,
                linkObj.depth + 1,
                linkObj
              );
              addToLinkQueue(newLinkObj, session.linksQueue, session);
            }
          });
      } else {
        console.log("No more links found");
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
        setRootNode(session);
      }
    } catch (err) {
      console.log("Something Went Wrong...", err);
    }
  }

  //Set the index of RootNode to the parent node
  function setRootNode(session) {
    while (session.currentNode.parent != null) {
      session.currentNode = session.currentNode.parent;
    }
    session.rootNode = session.currentNode;
  }

  //Check if the domain is a part of the root site
  function checkDomain(linkURL, session) {
    let parsedUrl;
    let fullUrl = true;
    try {
      parsedUrl = new URL(linkURL);
    } catch (error) {
      fullUrl = false;
    }
    if (fullUrl === false) {
      if (linkURL.indexOf("/") === 0) {
        //relative to domain url
        return (
          session.mainParsedUrl.protocol +
          "/" +
          session.mainParsedUrl.hostname +
          linkURL.split("#")[0]
        );
      } else if (linkURL.indexOf("#") === 0) {
        return;
      } else {
        //relative url
        let path = session.currentNode.url.match(".*/")[0];
        return path + linkURL;
      }
    }
    let mainHostDomain = parsedUrl.hostname;

    if (session.mainDomain == mainHostDomain) {
      parsedUrl.hash = "";
      return parsedUrl.href;
    } else {
      return;
    }
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
      propegateMsg(resObj, session.ws);
    }
  }

  function propegateMsg(resObj, ws) {
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
    let linkMsg = stringify(msgObj);
    app.models.crawl_history.upsert(msgObj);
    ws.send(linkMsg);
  }

  function getNextInQueue(session) {
    let nextLink = session.linksQueue.shift();
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
