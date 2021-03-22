"use strict";

const crawler = (function () {
  const cheerio = require("cheerio");
  const { URL } = require("url");
  const puppeteer = require("puppeteer");

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

  //Start Application put here the adress where you want to start your crawling with
  //second parameter is depth with 1 it will scrape all the links found on the first page but not the ones found on other pages
  //if you put 2 it will scrape all links on first page and all links found on second level pages be careful with this on a huge website it will represent tons of pages to scrape
  // it is recommanded to limit to 5 levels
  //crawlBFS("https://www.scraping-bot.io/", 1);

  async function crawlBFS(socket, startURL, maxDepth = 5, maxPages = 15) {
    let session = {
      seenLinks: {},
      rootNode: {},
      currentNode: {},
      linksQueue: [],
      printList: [],
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

  //The goal is to get the HTML and look for the links inside the page.
  async function findLinks(session, linkObj) {
    let linkMsg = JSON.stringify({
      url: linkObj.url,
      title: linkObj.title,
      depth: linkObj.depth,
      parent: linkObj.parent ? linkObj.parent.url : null,
    });
    session.ws.send(linkMsg);
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
        //next url scraping
        await findLinks(session, nextLinkObj);
      } else {
        setRootNode(session);
        printTree(session.rootNode, session.printList, session.ws);
      }
    } catch (err) {
      console.log("Something Went Wrong...", err);
    }
  }

  //Go all the way up and set RootNode to the parent node
  function setRootNode(session) {
    while (session.currentNode.parent != null) {
      session.currentNode = session.currentNode.parent;
    }
    session.rootNode = session.currentNode;
  }

  function printTree(rootNode, printList, ws) {
    addToPrintDFS(rootNode, printList);
    let res = { summary: printList.join("\n|") };
    ws.send(JSON.stringify(res));
  }

  function addToPrintDFS(node, printList) {
    let spaces = Array(node.depth * 3).join("-");
    printList.push(spaces + node.url);
    if (node.children) {
      node.children.map(function (i, x) {
        {
          addToPrintDFS(i, printList);
        }
      });
    }
  }

  //Check if the domain belongs to the root site
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
        //anchor avoid link
        return;
      } else {
        //relative url
        let path = session.currentNode.url.match(".*/")[0];
        return path + linkURL;
      }
    }

    let mainHostDomain = parsedUrl.hostname;

    if (session.mainDomain == mainHostDomain) {
      //console.log("returning Full Link: " + linkURL);
      parsedUrl.hash = "";
      return parsedUrl.href;
    } else {
      return;
    }
  }

  function addToLinkQueue(linkobj, linksQueue, session) {
    if (!linkInSeenListExists(session, linkobj)) {
      if (linkobj.parent != null) {
        linkobj.parent.children.push(linkobj);
      }
      linksQueue.push(linkobj);
      addToSeen(session, linkobj);
    }
  }

  function getNextInQueue(session) {
    let nextLink = session.linksQueue.shift();
    if (nextLink && nextLink.depth > session.previousDepth) {
      session.previousDepth = nextLink.depth;
      console.log(
        `------- CRAWLING ON DEPTH LEVEL ${session.previousDepth} --------`
      );
    }
    return nextLink;
  }

  //Adds links we've visited to the seenList
  function addToSeen(session, linkObj) {
    session.seenLinks[linkObj.url] = linkObj;
  }

  //Returns whether the link has been seen.
  function linkInSeenListExists(session, linkObj) {
    return session.seenLinks[linkObj.url] == null ? false : true;
  }
  return {
    crawlBFS: crawlBFS,
  };
})();

module.exports = crawler;
