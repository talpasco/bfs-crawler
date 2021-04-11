# Run Web site with BFS crawling capabilities

* Server
    * WS JS
    * Express JS
    * LoopBack JS
    * Redis - PubSub + cacheDB
* Client
    * Vue

## Requirements

* [Node.js](https://nodejs.org/) (this sample tested with 10.x)
* [Git](https://git-scm.com/downloads)
* REDIS: 
    - Windows: https://redislabs.com/ebook/appendix-a/a-3-installing-on-windows/a-3-2-installing-redis-on-window/
    - Linux: https://redis.io/topics/quickstart

## Get Code

* Clone or download this [repository](https://bitbucket.org/talpasco/bfs-crawler)
    * `git clone https://bitbucket.org/talpasco/bfs-crawler` 
* `cd bfs-crawler` - move into directory just created
* `npm install` to install dependencies

## Build website code
 
* `npm run prebuild` to prep directories
* `npm run build` to transpile typescript into javascript into `/dist` folder

## Run website code

* `npm run open` to open browser to http://localhost:3001
* `npm run start`


## Run process over and over

* `npm run start:all:again` - prebuilt, build, start, and open in browser

## API Explorer

* Added the crawler API, to search/post through crawling history (And a fulll CRUD functionality - Strongloop API) : http://localhost:3001/explorer/#/

## TODOS:

* Sticky sessions and PubSub - Using Redis-PubSub and Redis-Store, making sure the socket would stick to that specific server instance (within the thread or via load-balancer)
* Unit Tests.
* Split the teplate.html file into html, scss , js and veu files