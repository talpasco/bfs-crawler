# Run Web site with BFS crawling capabilities

* Server
    * WS JS
    * Express JS
* Client
    * Vue

## Requirements

* [Node.js](https://nodejs.org/) (this sample tested with 10.x)
* [Git](https://git-scm.com/downloads)

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

## TODOS:

* I was able to commit (commit 7fadb37) - Within 3 hectic days, and I'm not satisfied with what I had achieved, So every progress being made afterwardth isn't within the time frame.
* Sticky sessions and PubSub - Using Redis-PubSub and Redis-Store, making sure the socket would stick to that specific server instance (within the thread or via load-balancer)
* Store the results within a DB - using Redis, store the query and the results, and then, if there's a query with a deeper depth, to fetch only the depth that hasn't been reached yet.
* Unit Tests.