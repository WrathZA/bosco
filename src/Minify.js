var _ = require('lodash');
var fs = require('fs');
var UglifyJS = require('uglify-js');
var CleanCSS = require('clean-css');

module.exports = function(bosco) {
  var createKey = require('./AssetHelper')(bosco).createKey;

  function minify(staticAssets, next) {
    var jsAssets = _.where(staticAssets, {type:'js'});
    var cssAssets = _.where(staticAssets, {type:'css'});
    var remainingAssets = _.filter(staticAssets, function(item) {
      return item.type !== 'js' && item.type !== 'css';
    });

    compileJs(remainingAssets, jsAssets, function(err, minifiedStaticAssets) {
      compileCss(minifiedStaticAssets, cssAssets, next);
    });

  }

  return {
    minify: minify
  }

  function compileJs(staticAssets, jsAssets, next) {
    var bundleKeys = _.uniq(_.pluck(jsAssets, 'bundleKey'));

    _.forEach(bundleKeys, function(bundleKey) {
      var items = _.where(jsAssets, {bundleKey: bundleKey});

      if(items.length === 0) { return; }

      var compiled, serviceName, buildNumber, tag, externalBuild;

      bosco.log('Compiling ' + _.size(items) + ' ' + bundleKey.blue + ' JS assets ...');

      var uglifyConfig = bosco.config.get('js:uglify');

      if(!serviceName) {
        var firstItem = items[0];
        serviceName = firstItem.serviceName;
        buildNumber = firstItem.buildNumber;
        tag = firstItem.tag;
        externalBuild = firstItem.externalBuild;
      }

      var uglifyOptions = {
        output: uglifyConfig ? uglifyConfig.outputOptions : null,
        compressor: uglifyConfig ? uglifyConfig.compressorOptions : null,
        mangle: uglifyConfig ? uglifyConfig.mangle : null,
        outSourceMap: tag + '.js.map',
        sourceMapIncludeSources: true
      };

      try {
        compiled = UglifyJS.minify(_.values(_.pluck(items,'path')), uglifyOptions);
      } catch (ex) {
        bosco.error('There was an error minifying files in ' + bundleKey.blue + ', error:');
        console.log(ex.message + '\n');
        compiled = {
          code: ''
        };
      }


      var mapKey = createKey(serviceName, buildNumber, tag, 'js', 'js', 'map');

      var mapItem = {};
      mapItem.assetKey = mapKey;
      mapItem.serviceName = serviceName;
      mapItem.buildNumber = buildNumber;
      mapItem.path = 'js-source-map';
      mapItem.relativePath = 'js-source-map';
      mapItem.extname = '.map';
      mapItem.tag = tag;
      mapItem.type = 'js';
      mapItem.mimeType = 'application/javascript';
      mapItem.content = compiled.map;
      staticAssets.push(mapItem);

      var minifiedKey = createKey(serviceName, buildNumber, tag, null, 'js', 'js');
      var minifiedItem = {};
      minifiedItem.assetKey = minifiedKey;
      minifiedItem.serviceName = serviceName;
      minifiedItem.buildNumber = buildNumber;
      minifiedItem.path = 'minified-js';
      minifiedItem.relativePath = 'minified-js';
      minifiedItem.extname = '.js';
      minifiedItem.tag = tag;
      minifiedItem.type = 'js';
      minifiedItem.mimeType = 'application/javascript';
      minifiedItem.content = compiled.code;
      staticAssets.push(minifiedItem);

    });

    next(null, staticAssets);

  }

  function compileCss(staticAssets, cssAssets, next) {
    var bundleKeys = _.uniq(_.pluck(cssAssets, 'bundleKey'));


    _.forEach(bundleKeys, function(bundleKey) {
      var items = _.where(cssAssets, {bundleKey: bundleKey});
      var cssContent = '', serviceName, buildNumber, tag;

      if(items.length === 0) { return; }

      if(!serviceName) {
        var firstItem = items[0];
        serviceName = firstItem.serviceName;
        buildNumber = firstItem.buildNumber;
        tag = firstItem.tag;
      }

      bosco.log('Compiling ' + _.size(items) + ' ' + bundleKey.blue + ' CSS assets ...');

      _.forEach(items, function(file) {
        cssContent += fs.readFileSync(file.path);
      });

      var cleanCssConfig = bosco.config.get('css:clean');
      if(cleanCssConfig && cleanCssConfig.enabled) {
        cssContent = new CleanCSS(cleanCssConfig.options).minify(cssContent).styles;
      }
      if (cssContent.length === 0) return next({
        message: 'No css for tag ' + tag
      });

      var assetKey = createKey(serviceName, buildNumber, tag, null, 'css', 'css');

      var minifiedItem = {};
      minifiedItem.assetKey = assetKey;
      minifiedItem.serviceName = serviceName;
      minifiedItem.buildNumber = buildNumber;
      minifiedItem.path = 'minified-css';
      minifiedItem.relativePath = 'minified-css';
      minifiedItem.extname = '.css';
      minifiedItem.tag = tag;
      minifiedItem.type = 'css';
      minifiedItem.mimeType = 'text/css';
      minifiedItem.content = cssContent;
      staticAssets.push(minifiedItem);

    });

    next(null, staticAssets);

  }


}
