let cur_path = require("path");
module.exports = function (serverApp) {
  let models = require(cur_path.resolve(__dirname, "../model-config.json"));
  let datasources = require(cur_path.resolve(__dirname, "../datasources.json"));

  function autoUpdateAll() {
    Object.keys(models).forEach(function (key) {
      if (typeof models[key].dataSource != "undefined") {
        if (typeof datasources[models[key].dataSource] != "undefined") {
          // if (models[key].dataSource == 'rds') {
          serverApp.dataSources[models[key].dataSource].autoupdate(
            key,
            function (err) {
              if (err) console.log(err);
              else console.log("Model " + key + " updated");
            }
          );
          // }
        }
      }
    });
  }

  function autoMigrateAll() {
    Object.keys(models).forEach(function (key) {
      if (typeof models[key].dataSource != "undefined") {
        if (typeof datasources[models[key].dataSource] != "undefined") {
          app.dataSources[models[key].dataSource].automigrate(key, function (
            err
          ) {
            if (err) console.log(err);
            else console.log("Model " + key + " migrated");
          });
        }
      }
    });
  }
  //autoMigrateAll();
  autoUpdateAll(); //TODO: Use this for the CI/CD process instead of 'autoMigrateAll'
};
//# sourceMappingURL=autoupdate.js.map
